/**
 * Хранение профиля в localStorage, демо-профиль, экспорт и импорт JSON.
 */
(function (ns) {
  'use strict';

  var V = ns.validation;
  var KEY = 'account-ai.profile.v1';
  var FORMAT = 'account-ai-profile';
  var VERSION = 1;
  var MAX_IMPORT_CHARS = 3 * 1024 * 1024;

  function getStorage(storage) {
    if (storage) return storage;
    try { return window.localStorage; } catch (e) { return null; }
  }

  /** Демо-профиль вымышленного человека. */
  function demoProfile() {
    return {
      lastName: 'Ковалёва',
      firstName: 'Анна',
      middleName: 'Сергеевна',
      organization: 'ООО «Северный ветер» (вымышленная компания)',
      position: 'Ведущий frontend-разработчик',
      phone: '+79001234567',
      email: 'anna.kovaleva@example.com',
      about: 'Делаю удобные и доступные интерфейсы. Люблю чистую вёрстку, аккуратную типографику и понятные формы.\n\nЭто демо-профиль вымышленного человека — нажмите «Редактировать», чтобы заполнить свои данные.',
      photo: '',
      social: {
        vk: 'https://vk.com/anna_kovaleva_demo',
        telegram: 'https://t.me/anna_kovaleva_demo',
        github: 'https://github.com/anna-kovaleva-demo',
        linkedin: 'https://www.linkedin.com/in/anna-kovaleva-demo',
        website: 'https://example.com/'
      }
    };
  }

  /**
   * Загружает профиль.
   * @returns {{profile: Object, source: 'stored'|'demo'|'corrupt', updatedAt: string}}
   */
  function load(storage) {
    var s = getStorage(storage);
    var raw = null;
    try { raw = s ? s.getItem(KEY) : null; } catch (e) { raw = null; }
    if (!raw) return { profile: demoProfile(), source: 'demo', updatedAt: '' };
    try {
      var data = JSON.parse(raw);
      var candidate = data && typeof data === 'object' && data.profile ? data.profile : data;
      var res = V.validateProfile(candidate);
      if (!res.valid) return { profile: demoProfile(), source: 'corrupt', updatedAt: '' };
      var updatedAt = data && typeof data.updatedAt === 'string' && !isNaN(Date.parse(data.updatedAt)) ? data.updatedAt : '';
      return { profile: res.value, source: 'stored', updatedAt: updatedAt };
    } catch (e) {
      return { profile: demoProfile(), source: 'corrupt', updatedAt: '' };
    }
  }

  /**
   * Проверяет и сохраняет профиль. Бросает Error с понятным сообщением.
   * @returns {{profile: Object, updatedAt: string}}
   */
  function save(profile, storage) {
    var res = V.validateProfile(profile);
    if (!res.valid) {
      var err = new Error('Профиль содержит ошибки');
      err.fieldErrors = res.errors;
      throw err;
    }
    var s = getStorage(storage);
    if (!s) throw new Error('Хранилище браузера недоступно — данные не сохранены');
    var updatedAt = new Date().toISOString();
    try {
      s.setItem(KEY, JSON.stringify({ version: VERSION, updatedAt: updatedAt, profile: res.value }));
    } catch (e) {
      throw new Error('Не удалось сохранить: недостаточно места в хранилище браузера. Попробуйте фото меньшего размера.');
    }
    return { profile: res.value, updatedAt: updatedAt };
  }

  function clear(storage) {
    var s = getStorage(storage);
    try { if (s) s.removeItem(KEY); } catch (e) { /* игнорируем */ }
  }

  /** Сериализует профиль для экспорта. */
  function exportJson(profile) {
    var res = V.validateProfile(profile);
    return JSON.stringify({
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      profile: res.value
    }, null, 2);
  }

  /**
   * Разбирает, санитизирует и проверяет импортируемый JSON.
   * @returns {{ok: boolean, profile?: Object, errors: string[]}}
   */
  function importJson(text) {
    if (typeof text !== 'string' || !text.trim()) return { ok: false, errors: ['Файл пуст'] };
    if (text.length > MAX_IMPORT_CHARS) return { ok: false, errors: ['Файл слишком большой'] };
    var data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, errors: ['Файл не является корректным JSON'] }; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, errors: ['Ожидается объект профиля'] };
    }
    if (Object.prototype.hasOwnProperty.call(data, 'format') && data.format !== FORMAT) {
      return { ok: false, errors: ['Неизвестный формат файла'] };
    }
    if (typeof data.version === 'number' && data.version > VERSION) {
      return { ok: false, errors: ['Файл создан более новой версией приложения'] };
    }
    var candidate = data.profile && typeof data.profile === 'object' ? data.profile : data;
    var res = V.validateProfile(candidate);
    if (!res.valid) {
      return {
        ok: false,
        errors: Object.keys(res.errors).map(function (k) { return res.errors[k]; })
      };
    }
    return { ok: true, profile: res.value, errors: [] };
  }

  ns.storage = {
    KEY: KEY,
    THEME_KEY: 'account-ai.theme',
    FORMAT: FORMAT,
    demoProfile: demoProfile,
    load: load,
    save: save,
    clear: clear,
    exportJson: exportJson,
    importJson: importJson
  };
})(window.AccountAi = window.AccountAi || {});
