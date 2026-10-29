/**
 * Отрисовка профиля. Все данные выводятся через textContent / setAttribute,
 * ссылки повторно проверяются перед вставкой в href.
 */
(function (ns) {
  'use strict';

  var V = ns.validation;
  var el = ns.ui.el;
  var clear = ns.ui.clear;
  var icon = ns.icons.create;
  var LINK_REL = 'noopener noreferrer nofollow';

  function fullName(p) {
    return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ');
  }

  function initials(p) {
    var a = (p.firstName || '').charAt(0);
    var b = (p.lastName || '').charAt(0);
    var s = (a + b).toUpperCase();
    return s || '?';
  }

  /** Стабильный оттенок аватара по имени (0–5). */
  function tone(p) {
    var s = fullName(p);
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 6;
  }

  /**
   * Заполняет контейнер аватара: фото или инициалы.
   * @param {HTMLElement} box
   * @param {Object} p профиль
   */
  function renderAvatar(box, p) {
    clear(box);
    box.setAttribute('data-tone', String(tone(p)));
    var name = fullName(p) || 'пользователя';
    if (p.photo && !V.validatePhoto(p.photo)) {
      var img = el('img', { src: p.photo, alt: 'Фото: ' + name, width: 512, height: 512, decoding: 'async' });
      img.addEventListener('error', function () { renderAvatar(box, Object.assign({}, p, { photo: '' })); });
      box.appendChild(img);
      box.classList.add('avatar--photo');
    } else {
      box.classList.remove('avatar--photo');
      box.appendChild(el('span', { 'class': 'avatar__initials', role: 'img', 'aria-label': 'Инициалы: ' + name }, initials(p)));
    }
  }

  function copyButton(value, label) {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') return null;
    var btn = el('button', { type: 'button', 'class': 'icon-btn icon-btn--sm', 'aria-label': 'Скопировать ' + label, title: 'Скопировать' }, icon('copy', { size: 16 }));
    btn.addEventListener('click', function () {
      navigator.clipboard.writeText(value).then(function () {
        ns.ui.toast(label.charAt(0).toUpperCase() + label.slice(1) + ' скопирован', { type: 'info', timeout: 2000 });
      }, function () {
        ns.ui.toast('Не удалось скопировать', { type: 'error' });
      });
    });
    return btn;
  }

  function infoRow(iconName, term, valueNode, extra) {
    return el('div', { 'class': 'info-list__row' }, [
      el('span', { 'class': 'info-list__icon', 'aria-hidden': 'true' }, icon(iconName, { size: 18 })),
      el('div', { 'class': 'info-list__body' }, [
        el('dt', { 'class': 'info-list__term' }, term),
        el('dd', { 'class': 'info-list__value' }, valueNode)
      ]),
      extra || null
    ]);
  }

  function empty(text) {
    return el('span', { 'class': 'muted' }, text);
  }

  function renderContacts(dl, p) {
    clear(dl);
    var org = p.organization || p.position
      ? el('span', null, [p.organization || '', p.organization && p.position ? el('span', { 'class': 'muted' }, ' · ' + p.position) : (p.position || '')])
      : empty('Не указана');
    dl.appendChild(infoRow('building', 'Организация', org));

    if (p.phone) {
      var tel = el('a', { href: 'tel:' + p.phone, 'class': 'link' }, V.formatPhone(p.phone));
      dl.appendChild(infoRow('phone', 'Телефон', tel, copyButton(V.formatPhone(p.phone), 'телефон')));
    } else {
      dl.appendChild(infoRow('phone', 'Телефон', empty('Не указан')));
    }

    if (p.email && !V.normalizeEmail(p.email).error) {
      var mail = el('a', { href: 'mailto:' + p.email, 'class': 'link link--break' }, p.email);
      dl.appendChild(infoRow('mail', 'E-mail', mail, copyButton(p.email, 'e-mail')));
    } else {
      dl.appendChild(infoRow('mail', 'E-mail', empty('Не указан')));
    }
  }

  function renderSocial(ul, p) {
    clear(ul);
    var any = false;
    V.SOCIAL_KEYS.forEach(function (key) {
      var href = V.safeHref(key, p.social && p.social[key]);
      if (!href) return;
      any = true;
      var label = V.SOCIAL_LABELS[key];
      var a = el('a', {
        'class': 'social-link social-link--' + key,
        href: href,
        target: '_blank',
        rel: LINK_REL,
        'aria-label': label + ': ' + V.socialHandle(key, href) + ' (откроется в новой вкладке)'
      }, [
        el('span', { 'class': 'social-link__icon' }, icon(key === 'website' ? 'globe' : key, { size: 22 })),
        el('span', { 'class': 'social-link__text' }, [
          el('span', { 'class': 'social-link__label' }, label),
          el('span', { 'class': 'social-link__handle' }, V.socialHandle(key, href))
        ]),
        el('span', { 'class': 'social-link__ext' }, icon('external', { size: 16 }))
      ]);
      ul.appendChild(el('li', null, a));
    });
    if (!any) ul.appendChild(el('li', { 'class': 'muted' }, 'Ссылки пока не добавлены'));
  }

  function renderAbout(box, p) {
    clear(box);
    if (!p.about) {
      box.appendChild(el('p', { 'class': 'muted' }, 'Пока ничего не рассказано.'));
      return;
    }
    p.about.split(/\n{2,}/).forEach(function (para) {
      var node = el('p');
      para.split('\n').forEach(function (line, i) {
        if (i) node.appendChild(el('br'));
        node.appendChild(document.createTextNode(line));
      });
      box.appendChild(node);
    });
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  /**
   * Полная отрисовка страницы профиля.
   * @param {Object} p
   * @param {{source?: string, updatedAt?: string}} [meta]
   */
  function renderProfile(p, meta) {
    meta = meta || {};
    var name = fullName(p) || 'Без имени';
    document.getElementById('profile-name').textContent = name;
    var metaEl = document.getElementById('profile-meta');
    clear(metaEl);
    if (p.position) metaEl.appendChild(el('span', { 'class': 'hero__chip' }, [icon('briefcase', { size: 16 }), p.position]));
    if (p.organization) metaEl.appendChild(el('span', { 'class': 'hero__chip' }, [icon('building', { size: 16 }), p.organization]));
    metaEl.hidden = !metaEl.firstChild;

    renderAvatar(document.getElementById('profile-avatar'), p);
    renderAbout(document.getElementById('profile-about'), p);
    renderContacts(document.getElementById('profile-contacts'), p);
    renderSocial(document.getElementById('profile-social'), p);

    var upd = document.getElementById('profile-updated');
    if (upd) {
      upd.textContent = meta.source === 'stored' && meta.updatedAt
        ? 'Последнее сохранение: ' + formatDate(meta.updatedAt)
        : 'Сейчас показан демо-профиль.';
    }
    document.title = name + ' — профиль · Account-Ai';
  }

  ns.render = {
    LINK_REL: LINK_REL,
    fullName: fullName,
    initials: initials,
    renderAvatar: renderAvatar,
    renderProfile: renderProfile
  };
})(window.AccountAi = window.AccountAi || {});
