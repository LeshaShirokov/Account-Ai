/**
 * Обработка фото на клиенте: проверка файла, обрезка до квадрата
 * по центру и уменьшение до 512×512 через canvas.
 */
(function (ns) {
  'use strict';

  var MAX_BYTES = 5 * 1024 * 1024;
  var MIN_SIDE = 64;
  var OUTPUT = 512;
  var TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  /** @returns {string} текст ошибки или пустая строка */
  function validateFile(file) {
    if (!file) return 'Файл не выбран';
    if (TYPES.indexOf(file.type) === -1) return 'Неподдерживаемый формат. Выберите JPG, PNG, WebP или GIF';
    if (file.size === 0) return 'Файл пуст';
    if (file.size > MAX_BYTES) return 'Файл больше 5 МБ (' + (file.size / 1048576).toFixed(1).replace('.', ',') + ' МБ)';
    return '';
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать изображение — файл повреждён или это не картинка')); };
      img.src = url;
    });
  }

  /** Вычисляет квадратную область по центру. */
  function squareCrop(width, height, maxSize) {
    var side = Math.min(width, height);
    return {
      sx: Math.round((width - side) / 2),
      sy: Math.round((height - side) / 2),
      side: side,
      out: Math.min(maxSize || OUTPUT, side)
    };
  }

  /**
   * @param {File} file
   * @returns {Promise<string>} data URL (image/jpeg) квадратного изображения ≤ 512px
   */
  function processFile(file) {
    var err = validateFile(file);
    if (err) return Promise.reject(new Error(err));
    return loadImage(file).then(function (img) {
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      if (!w || !h) throw new Error('Не удалось определить размер изображения');
      if (Math.min(w, h) < MIN_SIDE) throw new Error('Изображение слишком маленькое (минимум ' + MIN_SIDE + '×' + MIN_SIDE + ' px)');
      var c = squareCrop(w, h, OUTPUT);
      var canvas = document.createElement('canvas');
      canvas.width = c.out;
      canvas.height = c.out;
      var ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Браузер не поддерживает обработку изображений');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff'; // прозрачный фон PNG → белый (JPEG без альфа-канала)
      ctx.fillRect(0, 0, c.out, c.out);
      ctx.drawImage(img, c.sx, c.sy, c.side, c.side, 0, 0, c.out, c.out);
      var data = canvas.toDataURL('image/jpeg', 0.86);
      if (ns.validation.validatePhoto(data)) throw new Error('Не удалось обработать изображение');
      return data;
    });
  }

  ns.photo = { MAX_BYTES: MAX_BYTES, TYPES: TYPES, validateFile: validateFile, squareCrop: squareCrop, processFile: processFile };
})(window.AccountAi = window.AccountAi || {});
