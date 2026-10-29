/**
 * Точка входа: связывает хранилище, отрисовку и редактор.
 */
(function (ns) {
  'use strict';

  var S = ns.storage;
  var ui = ns.ui;

  function init() {
    ns.icons.hydrate(document);
    ui.initTheme(document.getElementById('theme-toggle'), S.THEME_KEY);

    var viewProfile = document.getElementById('view-profile');
    var viewEdit = document.getElementById('view-edit');
    var editBtn = document.getElementById('edit-btn');

    var loaded = S.load();
    var current = { profile: loaded.profile, source: loaded.source, updatedAt: loaded.updatedAt };

    function render() {
      ns.render.renderProfile(current.profile, current);
    }

    function scrollTop() {
      window.scrollTo({ top: 0, behavior: ui.prefersReducedMotion() ? 'auto' : 'smooth' });
    }

    function showProfile(focusEdit) {
      editor.close();
      viewEdit.hidden = true;
      viewProfile.hidden = false;
      render();
      scrollTop();
      if (focusEdit) editBtn.focus();
    }

    function showEdit() {
      editor.open(current.profile);
      viewProfile.hidden = true;
      viewEdit.hidden = false;
      scrollTop();
      document.getElementById('edit-title').focus({ preventScroll: true });
    }

    var editor = ns.editor.create({
      form: document.getElementById('profile-form'),
      onSave: function (profile) {
        var res = S.save(profile);
        current = { profile: res.profile, source: 'stored', updatedAt: res.updatedAt };
        showProfile(true);
        ui.toast('Профиль сохранён');
      },
      onClose: function () { showProfile(true); }
    });

    editBtn.addEventListener('click', showEdit);

    window.addEventListener('beforeunload', function (e) {
      if (editor.isDirty()) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return undefined;
    });

    // --- Экспорт ---
    document.getElementById('export-btn').addEventListener('click', function () {
      var json = S.exportJson(current.profile);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = ui.el('a', { href: url, download: 'account-ai-profile-' + new Date().toISOString().slice(0, 10) + '.json' });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      ui.toast('Профиль экспортирован в JSON', { type: 'info' });
    });

    // --- Импорт ---
    var importInput = document.getElementById('import-input');
    document.getElementById('import-btn').addEventListener('click', function () { importInput.click(); });
    importInput.addEventListener('change', function () {
      var file = importInput.files && importInput.files[0];
      importInput.value = '';
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) { ui.toast('Файл слишком большой (максимум 3 МБ)', { type: 'error' }); return; }
      readText(file).then(function (text) {
        var res = S.importJson(text);
        if (!res.ok) {
          ui.toast('Импорт отклонён: ' + res.errors.slice(0, 3).join('; ') + (res.errors.length > 3 ? '…' : ''), { type: 'error' });
          return null;
        }
        return ui.confirm({
          title: 'Импортировать профиль?',
          message: 'Текущий профиль будет заменён данными из файла «' + ns.validation.cleanText(file.name, 80) + '».',
          confirmText: 'Импортировать'
        }).then(function (ok) {
          if (!ok) return;
          var saved = S.save(res.profile);
          current = { profile: saved.profile, source: 'stored', updatedAt: saved.updatedAt };
          render();
          ui.toast('Профиль импортирован');
        });
      }).catch(function (err) {
        ui.toast(err && err.message ? err.message : 'Не удалось прочитать файл', { type: 'error' });
      });
    });

    // --- Сброс ---
    document.getElementById('reset-btn').addEventListener('click', function () {
      ui.confirm({
        title: 'Сбросить профиль?',
        message: 'Сохранённые данные будут удалены из браузера, и снова появится демо-профиль. Это действие нельзя отменить.',
        confirmText: 'Сбросить',
        danger: true
      }).then(function (ok) {
        if (!ok) return;
        S.clear();
        current = { profile: S.demoProfile(), source: 'demo', updatedAt: '' };
        render();
        ui.toast('Профиль сброшен к демо-данным', { type: 'info' });
      });
    });

    render();
    if (loaded.source === 'corrupt') {
      ui.toast('Сохранённый профиль повреждён — показан демо-профиль', { type: 'error' });
    }

    ns.app = { getCurrent: function () { return current; }, editor: editor, showEdit: showEdit };
  }

  function readText(file) {
    if (typeof file.text === 'function') return file.text();
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = function () { reject(new Error('Не удалось прочитать файл')); };
      r.readAsText(file);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.AccountAi = window.AccountAi || {});
