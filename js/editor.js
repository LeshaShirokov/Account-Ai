/**
 * Режим редактирования: заполнение формы, проверка полей, загрузка фото,
 * предупреждение о несохранённых изменениях.
 */
(function (ns) {
  'use strict';

  var V = ns.validation;

  /**
   * @param {{form: HTMLFormElement, onSave: function(Object): void, onClose: function(): void}} opts
   */
  function createEditor(opts) {
    var form = opts.form;
    var preview = document.getElementById('photo-preview');
    var photoInput = document.getElementById('photo-input');
    var photoPick = document.getElementById('photo-pick');
    var photoRemove = document.getElementById('photo-remove');
    var photoError = document.getElementById('photo-error');
    var aboutCounter = document.getElementById('c-about');
    var saveBtn = document.getElementById('save-btn');

    var state = { photo: '', snapshot: '', busy: false, open: false };

    function fields() {
      return Array.prototype.filter.call(form.elements, function (f) {
        return f.name && (f.tagName === 'INPUT' || f.tagName === 'TEXTAREA') && f.type !== 'file';
      });
    }

    function field(name) { return form.elements.namedItem(name); }

    function errorEl(input) {
      return document.getElementById('e-' + input.id.replace(/^f-/, ''));
    }

    function setError(input, message) {
      var box = errorEl(input);
      if (box) box.textContent = message || '';
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      var wrap = input.closest('.field');
      if (wrap) wrap.classList.toggle('field--invalid', !!message);
    }

    function telegramDisplay(url) {
      var m = /^https:\/\/t\.me\/([A-Za-z0-9_]+)$/.exec(url || '');
      return m ? '@' + m[1] : (url || '');
    }

    /** Собирает данные формы в объект профиля (без нормализации). */
    function read() {
      var p = V.emptyProfile();
      fields().forEach(function (f) {
        if (f.name.indexOf('social.') === 0) p.social[f.name.slice(7)] = f.value;
        else p[f.name] = f.value;
      });
      p.photo = state.photo;
      return p;
    }

    function updateCounter() {
      var len = field('about').value.length;
      aboutCounter.textContent = len + ' / ' + V.LIMITS.about;
      aboutCounter.classList.toggle('hint--warn', len > V.LIMITS.about * 0.9);
    }

    function updatePreview() {
      var p = read();
      ns.render.renderAvatar(preview, p);
      photoRemove.disabled = !state.photo;
    }

    function fill(p) {
      field('lastName').value = p.lastName;
      field('firstName').value = p.firstName;
      field('middleName').value = p.middleName;
      field('organization').value = p.organization;
      field('position').value = p.position;
      field('phone').value = V.formatPhone(p.phone);
      field('email').value = p.email;
      field('about').value = p.about;
      V.SOCIAL_KEYS.forEach(function (k) {
        field('social.' + k).value = k === 'telegram' ? telegramDisplay(p.social[k]) : p.social[k];
      });
      state.photo = p.photo || '';
      fields().forEach(function (f) { setError(f, ''); f.removeAttribute('data-touched'); });
      photoError.textContent = '';
      updateCounter();
      updatePreview();
      state.snapshot = JSON.stringify(read());
    }

    function isDirty() {
      return state.open && JSON.stringify(read()) !== state.snapshot;
    }

    function validateInput(f) {
      var msg = V.validateField(f.name, f.value);
      setError(f, msg);
      return msg;
    }

    // --- События полей ---
    form.addEventListener('blur', function (e) {
      var f = e.target;
      if (!f.name || f.type === 'file') return;
      if (!f.value && !f.hasAttribute('data-touched') && !f.required) return;
      f.setAttribute('data-touched', '');
      var msg = validateInput(f);
      if (!msg && f.name === 'phone' && f.value) f.value = V.formatPhone(V.normalizePhone(f.value).value);
      if (!msg && f.name === 'email' && f.value) f.value = V.normalizeEmail(f.value).value;
    }, true);

    form.addEventListener('input', function (e) {
      var f = e.target;
      if (f.name === 'about') updateCounter();
      if (f.name === 'firstName' || f.name === 'lastName' || f.name === 'middleName') updatePreview();
      if (f.getAttribute('aria-invalid') === 'true') validateInput(f);
    });

    // --- Фото ---
    photoPick.addEventListener('click', function () { photoInput.click(); });

    photoInput.addEventListener('change', function () {
      var file = photoInput.files && photoInput.files[0];
      photoInput.value = '';
      if (!file) return;
      var err = ns.photo.validateFile(file);
      if (err) { photoError.textContent = err; return; }
      photoError.textContent = '';
      photoPick.disabled = true;
      photoPick.setAttribute('aria-busy', 'true');
      ns.photo.processFile(file).then(function (dataUrl) {
        state.photo = dataUrl;
        updatePreview();
        ns.ui.toast('Фото обработано: 512×512, не забудьте сохранить', { type: 'info' });
      }, function (e) {
        photoError.textContent = e.message || 'Не удалось обработать фото';
      }).then(function () {
        photoPick.disabled = false;
        photoPick.removeAttribute('aria-busy');
      });
    });

    photoRemove.addEventListener('click', function () {
      state.photo = '';
      photoError.textContent = '';
      updatePreview();
      photoPick.focus();
    });

    // --- Сохранение / отмена ---
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (state.busy) return;
      var res = V.validateProfile(read());
      var first = null;
      fields().forEach(function (f) {
        var msg = res.errors[f.name] || '';
        setError(f, msg);
        if (msg && !first) first = f;
      });
      if (res.errors.photo) { photoError.textContent = res.errors.photo; if (!first) first = photoPick; }
      if (!res.valid) {
        if (first) first.focus();
        var count = Object.keys(res.errors).length;
        ns.ui.toast('Исправьте ошибки в форме (' + count + ')', { type: 'error' });
        return;
      }
      state.busy = true;
      saveBtn.disabled = true;
      try {
        opts.onSave(res.value);
        state.snapshot = JSON.stringify(read());
      } catch (err) {
        ns.ui.toast(err.message || 'Не удалось сохранить профиль', { type: 'error' });
      } finally {
        state.busy = false;
        saveBtn.disabled = false;
      }
    });

    document.getElementById('cancel-btn').addEventListener('click', function () { requestClose(); });

    form.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        var dialog = document.getElementById('confirm-dialog');
        if (dialog && dialog.open) return;
        e.preventDefault();
        requestClose();
      }
    });

    function requestClose() {
      if (!isDirty()) { opts.onClose(); return Promise.resolve(true); }
      return ns.ui.confirm({
        title: 'Отменить изменения?',
        message: 'Внесённые изменения не сохранены и будут потеряны.',
        confirmText: 'Не сохранять',
        cancelText: 'Вернуться к форме',
        danger: true
      }).then(function (ok) {
        if (ok) opts.onClose();
        return ok;
      });
    }

    return {
      open: function (profile) { state.open = true; fill(profile); },
      close: function () { state.open = false; },
      isOpen: function () { return state.open; },
      isDirty: isDirty,
      requestClose: requestClose,
      read: read
    };
  }

  ns.editor = { create: createEditor };
})(window.AccountAi = window.AccountAi || {});
