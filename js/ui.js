/**
 * Общие UI-утилиты: безопасное создание элементов, уведомления (toast),
 * диалог подтверждения и переключение темы.
 */
(function (ns) {
  'use strict';

  /**
   * Безопасно создаёт элемент. Текст вставляется только через textContent.
   * @param {string} tag
   * @param {Object} [attrs]  — атрибуты (class, href, aria-* …)
   * @param {Array<Node|string>|Node|string} [children]
   */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (/^on/i.test(k)) return; // обработчики событий — только через addEventListener
        node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children === null || children === undefined) return node;
    (Array.isArray(children) ? children : [children]).forEach(function (ch) {
      if (ch === null || ch === undefined || ch === false) return;
      node.appendChild(typeof ch === 'string' || typeof ch === 'number' ? document.createTextNode(String(ch)) : ch);
    });
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // ---------- Toast ----------

  /**
   * @param {string} message
   * @param {{type?: 'success'|'error'|'info', timeout?: number}} [opts]
   */
  function toast(message, opts) {
    opts = opts || {};
    var type = opts.type || 'success';
    var region = document.getElementById('toast-region');
    if (!region) return null;
    var icon = ns.icons.create(type === 'error' ? 'alert' : (type === 'info' ? 'alert' : 'check'), { size: 18 });
    var closeBtn = el('button', { type: 'button', 'class': 'toast__close', 'aria-label': 'Закрыть уведомление' }, ns.icons.create('x', { size: 16 }));
    var item = el('div', { 'class': 'toast toast--' + type, role: type === 'error' ? 'alert' : 'status' }, [
      el('span', { 'class': 'toast__icon' }, icon),
      el('span', { 'class': 'toast__text' }, message),
      closeBtn
    ]);
    function remove() {
      if (!item.parentNode) return;
      item.classList.add('toast--leaving');
      setTimeout(function () { if (item.parentNode) item.parentNode.removeChild(item); }, prefersReducedMotion() ? 0 : 200);
    }
    closeBtn.addEventListener('click', remove);
    if (type === 'success') {
      // Успех делает устаревшими предыдущие сообщения об ошибках
      Array.prototype.slice.call(region.querySelectorAll('.toast--error')).forEach(function (t) { region.removeChild(t); });
    }
    region.appendChild(item);
    while (region.children.length > 3) region.removeChild(region.firstChild);
    setTimeout(remove, opts.timeout || (type === 'error' ? 7000 : 3500));
    return item;
  }

  // ---------- Диалог подтверждения ----------

  /**
   * @param {{title: string, message: string, confirmText?: string, cancelText?: string, danger?: boolean}} o
   * @returns {Promise<boolean>}
   */
  function confirmDialog(o) {
    var dialog = document.getElementById('confirm-dialog');
    if (!dialog || typeof dialog.showModal !== 'function') {
      return Promise.resolve(window.confirm(o.title + '\n\n' + o.message));
    }
    var okBtn = document.getElementById('confirm-ok');
    var cancelBtn = document.getElementById('confirm-cancel');
    document.getElementById('confirm-title').textContent = o.title;
    document.getElementById('confirm-text').textContent = o.message;
    okBtn.textContent = o.confirmText || 'ОК';
    cancelBtn.textContent = o.cancelText || 'Отмена';
    okBtn.className = 'btn ' + (o.danger ? 'btn--danger' : 'btn--primary');
    var opener = document.activeElement;

    return new Promise(function (resolve) {
      function done(result) {
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        dialog.removeEventListener('cancel', onEsc);
        dialog.removeEventListener('click', onBackdrop);
        if (dialog.open) dialog.close();
        if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
        resolve(result);
      }
      function onOk() { done(true); }
      function onCancel() { done(false); }
      function onEsc(e) { e.preventDefault(); done(false); }
      function onBackdrop(e) { if (e.target === dialog) done(false); }
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      dialog.addEventListener('cancel', onEsc);
      dialog.addEventListener('click', onBackdrop);
      dialog.showModal();
      (o.danger ? cancelBtn : okBtn).focus();
    });
  }

  // ---------- Тема ----------

  function initTheme(button, storageKey) {
    var root = document.documentElement;
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function stored() {
      try { var t = localStorage.getItem(storageKey); return t === 'light' || t === 'dark' ? t : ''; } catch (e) { return ''; }
    }
    function apply(theme) {
      root.setAttribute('data-theme', theme);
      var dark = theme === 'dark';
      button.setAttribute('aria-pressed', dark ? 'true' : 'false');
      button.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
      var slot = button.querySelector('[data-icon]');
      if (slot) { slot.setAttribute('data-icon', dark ? 'sun' : 'moon'); ns.icons.hydrate(button); }
    }

    apply(stored() || (mq && mq.matches ? 'dark' : 'light'));

    button.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(storageKey, next); } catch (e) { /* без сохранения */ }
      apply(next);
    });

    if (mq) {
      var onChange = function (e) { if (!stored()) apply(e.matches ? 'dark' : 'light'); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  ns.ui = { el: el, append: append, clear: clear, toast: toast, confirm: confirmDialog, initTheme: initTheme, prefersReducedMotion: prefersReducedMotion };
})(window.AccountAi = window.AccountAi || {});
