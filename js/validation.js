/**
 * Валидация, нормализация и санитизация данных профиля.
 * Модуль не зависит от DOM и может тестироваться отдельно.
 */
(function (ns) {
  'use strict';

  var LIMITS = {
    name: 50,
    organization: 120,
    position: 80,
    phone: 24,
    email: 254,
    url: 300,
    about: 600,
    photo: 1500000 // длина data URL (~1,1 МБ бинарных данных)
  };

  var TEXT_FIELDS = ['lastName', 'firstName', 'middleName', 'organization', 'position', 'phone', 'email'];
  var SOCIAL_KEYS = ['vk', 'telegram', 'github', 'linkedin', 'website'];

  var CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
  var NAME_RE = /^[A-Za-zА-Яа-яЁё]+(?:[ '’\-][A-Za-zА-Яа-яЁё]+)*$/;
  var EMAIL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})$/;
  var HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
  var PHOTO_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
  var TG_USERNAME_RE = /^@?([A-Za-z][A-Za-z0-9_]{4,31})$/;

  /** Однострочный текст: убирает управляющие символы, схлопывает пробелы, обрезает. */
  function cleanText(value, max) {
    var s = typeof value === 'string' ? value : (typeof value === 'number' && isFinite(value) ? String(value) : '');
    s = s.replace(CONTROL_RE, '').replace(/\s+/g, ' ').trim();
    return max ? s.slice(0, max) : s;
  }

  /** Многострочный текст: сохраняет переводы строк (не более одной пустой строки подряд). */
  function cleanMultiline(value, max) {
    var s = typeof value === 'string' ? value : '';
    s = s.replace(/\r\n?/g, '\n').replace(CONTROL_RE, '');
    s = s.split('\n').map(function (line) { return line.replace(/[^\S\n]+/g, ' ').trim(); }).join('\n');
    s = s.replace(/\n{3,}/g, '\n\n').trim();
    return max ? s.slice(0, max) : s;
  }

  // ---------- Имена и текст ----------

  function validateName(value, label, required) {
    var s = cleanText(value);
    if (!s) return required ? 'Укажите ' + label.toLowerCase() : '';
    if (s.length < 2 && required) return label + ': минимум 2 символа';
    if (s.length > LIMITS.name) return label + ': не более ' + LIMITS.name + ' символов';
    if (!NAME_RE.test(s)) return label + ': только буквы, пробел, дефис или апостроф';
    return '';
  }

  function validatePlain(value, label, max) {
    var s = cleanText(value);
    if (s.length > max) return label + ': не более ' + max + ' символов';
    if (/[<>]/.test(s)) return label + ': символы «<» и «>» недопустимы';
    return '';
  }

  // ---------- Телефон ----------

  /**
   * Приводит российский номер к виду +7XXXXXXXXXX.
   * @returns {{value: string, error: string}}
   */
  function normalizePhone(input) {
    var raw = cleanText(input);
    if (!raw) return { value: '', error: '' };
    if (raw.length > LIMITS.phone) return { value: '', error: 'Слишком длинный номер телефона' };
    if (/[^\d\s()+\-.]/.test(raw)) {
      return { value: '', error: 'Телефон может содержать только цифры, пробелы, скобки, дефисы и «+»' };
    }
    if (raw.lastIndexOf('+') > 0) return { value: '', error: 'Знак «+» допустим только в начале номера' };
    var digits = raw.replace(/\D/g, '');
    if (raw.charAt(0) === '+') {
      if (digits.length !== 11 || digits.charAt(0) !== '7') {
        return { value: '', error: 'Поддерживаются российские номера: +7 и 10 цифр' };
      }
    } else if (digits.length === 11 && (digits.charAt(0) === '8' || digits.charAt(0) === '7')) {
      digits = '7' + digits.slice(1);
    } else if (digits.length === 10) {
      digits = '7' + digits;
    } else {
      return { value: '', error: 'Введите номер в формате +7 (900) 123-45-67' };
    }
    if (!/^7[3489]\d{9}$/.test(digits)) {
      return { value: '', error: 'Код после +7 должен начинаться с 3, 4, 8 или 9' };
    }
    return { value: '+' + digits, error: '' };
  }

  /** +79001234567 → +7 (900) 123-45-67 */
  function formatPhone(normalized) {
    if (!/^\+7\d{10}$/.test(normalized || '')) return normalized || '';
    var d = normalized.slice(2);
    return '+7 (' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6, 8) + '-' + d.slice(8, 10);
  }

  // ---------- E-mail ----------

  function normalizeEmail(input) {
    var s = cleanText(input).toLowerCase();
    if (!s) return { value: '', error: '' };
    if (s.length > LIMITS.email) return { value: '', error: 'E-mail слишком длинный' };
    var at = s.lastIndexOf('@');
    if (at < 1 || at > 64 || !EMAIL_RE.test(s)) {
      return { value: '', error: 'Введите корректный e-mail, например name@example.com' };
    }
    return { value: s, error: '' };
  }

  // ---------- Ссылки ----------

  /**
   * Разбирает ссылку, разрешая только http/https и корректный домен.
   * Если протокол не указан, добавляет https://.
   * @returns {{url: URL|null, error: string}}
   */
  function parseHttpUrl(input) {
    var s = cleanText(input);
    if (!s) return { url: null, error: '' };
    if (s.length > LIMITS.url) return { url: null, error: 'Ссылка слишком длинная (максимум ' + LIMITS.url + ' символов)' };
    if (/\s/.test(s)) return { url: null, error: 'Ссылка не должна содержать пробелы' };
    if (!/^https?:\/\//i.test(s)) {
      // Любая другая схема (javascript:, data:, ftp:// и т. п.) запрещена.
      if (/^[a-z][a-z0-9+.\-]*:(?!\d)/i.test(s) || /^\/\//.test(s)) {
        return { url: null, error: 'Разрешены только ссылки http:// и https://' };
      }
      s = 'https://' + s;
    }
    var url;
    try { url = new URL(s); } catch (e) { return { url: null, error: 'Некорректная ссылка' }; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { url: null, error: 'Разрешены только ссылки http:// и https://' };
    }
    if (url.username || url.password) return { url: null, error: 'Ссылка не должна содержать логин или пароль' };
    if (url.port) return { url: null, error: 'Ссылка не должна содержать порт' };
    if (!HOST_RE.test(url.hostname.toLowerCase())) return { url: null, error: 'Укажите корректный домен, например example.com' };
    return { url: url, error: '' };
  }

  function hostIn(list) {
    return function (host) { return list.indexOf(host) !== -1; };
  }

  var SOCIAL = {
    vk: {
      label: 'ВКонтакте',
      example: 'https://vk.com/username',
      host: hostIn(['vk.com', 'www.vk.com', 'm.vk.com', 'vk.ru', 'www.vk.ru', 'm.vk.ru']),
      path: /^\/([A-Za-z0-9_.]{2,64})\/?$/,
      canonicalHost: function (h) { return h.replace(/^(www|m)\./, ''); }
    },
    telegram: {
      label: 'Telegram',
      example: '@username или https://t.me/username',
      host: hostIn(['t.me', 'www.t.me', 'telegram.me', 'www.telegram.me']),
      path: /^\/([A-Za-z][A-Za-z0-9_]{4,31})\/?$/,
      canonicalHost: function () { return 't.me'; }
    },
    github: {
      label: 'GitHub',
      example: 'https://github.com/username',
      host: hostIn(['github.com', 'www.github.com']),
      path: /^\/([A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38})\/?$/,
      canonicalHost: function () { return 'github.com'; }
    },
    linkedin: {
      label: 'LinkedIn',
      example: 'https://www.linkedin.com/in/username',
      host: function (h) { return h === 'linkedin.com' || /^[a-z]{2,3}\.linkedin\.com$/.test(h); },
      path: /^\/((?:in|company|school)\/[^/?#]{2,100})\/?$/,
      canonicalHost: function () { return 'www.linkedin.com'; }
    }
  };

  /**
   * Нормализует ссылку на соцсеть.
   * @param {'vk'|'telegram'|'github'|'linkedin'|'website'} kind
   * @returns {{value: string, error: string}}
   */
  function normalizeSocial(kind, input) {
    var s = cleanText(input);
    if (!s) return { value: '', error: '' };

    if (kind === 'telegram' && s.indexOf('/') === -1 && s.indexOf('.') === -1) {
      var m = TG_USERNAME_RE.exec(s);
      if (!m) return { value: '', error: 'Имя пользователя Telegram: 5–32 символа (латиница, цифры, «_»), начинается с буквы' };
      return { value: 'https://t.me/' + m[1], error: '' };
    }

    var parsed = parseHttpUrl(s);
    if (parsed.error) return { value: '', error: parsed.error };
    var url = parsed.url;

    if (kind === 'website') {
      return { value: url.href, error: '' };
    }

    var spec = SOCIAL[kind];
    if (!spec) return { value: '', error: 'Неизвестная социальная сеть' };
    var host = url.hostname.toLowerCase();
    if (!spec.host(host)) {
      return { value: '', error: 'Это не ссылка на ' + spec.label + '. Пример: ' + spec.example };
    }
    var pm = spec.path.exec(url.pathname);
    if (!pm) {
      return { value: '', error: 'Укажите ссылку на профиль ' + spec.label + '. Пример: ' + spec.example };
    }
    return { value: 'https://' + spec.canonicalHost(host) + '/' + pm[1], error: '' };
  }

  /** Короткая подпись для ссылки: @username, github.com/user, домен сайта и т. п. */
  function socialHandle(kind, url) {
    try {
      var u = new URL(url);
      var path = u.pathname.replace(/\/+$/, '');
      if (kind === 'telegram') return '@' + path.slice(1);
      if (kind === 'website') return u.hostname.replace(/^www\./, '') + (path && path !== '/' ? decodeSafe(path) : '');
      if (kind === 'linkedin') return decodeSafe(path.slice(1));
      return u.hostname.replace(/^(www|m)\./, '') + decodeSafe(path);
    } catch (e) {
      return '';
    }
  }

  function decodeSafe(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  // ---------- Фото ----------

  function validatePhoto(value) {
    if (!value) return '';
    if (typeof value !== 'string' || value.length > LIMITS.photo || !PHOTO_RE.test(value)) {
      return 'Фото повреждено или имеет неподдерживаемый формат';
    }
    return '';
  }

  // ---------- Профиль целиком ----------

  function emptyProfile() {
    return {
      lastName: '', firstName: '', middleName: '',
      organization: '', position: '',
      phone: '', email: '', about: '', photo: '',
      social: { vk: '', telegram: '', github: '', linkedin: '', website: '' }
    };
  }

  /**
   * Санитизация «сырых» данных (например, из импортированного JSON):
   * оставляет только известные поля, приводит к строкам, убирает управляющие
   * символы, обрезает по длине. Не выполняет проверку формата.
   */
  function sanitizeProfile(raw) {
    var out = emptyProfile();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    var max = {
      lastName: LIMITS.name, firstName: LIMITS.name, middleName: LIMITS.name,
      organization: LIMITS.organization, position: LIMITS.position,
      phone: LIMITS.phone * 2, email: LIMITS.email
    };
    TEXT_FIELDS.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(raw, k)) out[k] = cleanText(raw[k], max[k]);
    });
    if (Object.prototype.hasOwnProperty.call(raw, 'about')) out.about = cleanMultiline(raw.about, LIMITS.about);
    var social = raw.social && typeof raw.social === 'object' && !Array.isArray(raw.social) ? raw.social : {};
    SOCIAL_KEYS.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(social, k)) out.social[k] = cleanText(social[k], LIMITS.url + 50);
    });
    var photo = typeof raw.photo === 'string' ? raw.photo.trim() : '';
    out.photo = validatePhoto(photo) ? '' : photo;
    return out;
  }

  /**
   * Полная проверка профиля.
   * @returns {{valid: boolean, errors: Object<string,string>, value: Object}}
   *   value — нормализованный профиль (телефон +7…, канонические ссылки).
   */
  function validateProfile(input) {
    var p = sanitizeProfile(input);
    var errors = {};
    var value = emptyProfile();

    function put(key, err) { if (err) errors[key] = err; }

    put('lastName', validateName(p.lastName, 'Фамилия', true));
    put('firstName', validateName(p.firstName, 'Имя', true));
    put('middleName', validateName(p.middleName, 'Отчество', false));
    put('organization', validatePlain(p.organization, 'Организация', LIMITS.organization));
    put('position', validatePlain(p.position, 'Должность', LIMITS.position));
    value.lastName = p.lastName;
    value.firstName = p.firstName;
    value.middleName = p.middleName;
    value.organization = p.organization;
    value.position = p.position;

    var ph = normalizePhone(p.phone);
    put('phone', ph.error);
    value.phone = ph.value;

    var em = normalizeEmail(p.email);
    if (!p.email) put('email', 'Укажите e-mail');
    else put('email', em.error);
    value.email = em.value;

    SOCIAL_KEYS.forEach(function (k) {
      var r = normalizeSocial(k, p.social[k]);
      put('social.' + k, r.error);
      value.social[k] = r.value;
    });

    if (p.about.length > LIMITS.about) put('about', 'Не более ' + LIMITS.about + ' символов');
    value.about = p.about;

    var photoInput = input && typeof input === 'object' ? input.photo : '';
    put('photo', validatePhoto(typeof photoInput === 'string' ? photoInput.trim() : photoInput));
    value.photo = p.photo;

    return { valid: Object.keys(errors).length === 0, errors: errors, value: value };
  }

  /** Проверка одного поля формы по имени (lastName, phone, social.vk …). */
  function validateField(name, rawValue) {
    switch (name) {
      case 'lastName': return validateName(rawValue, 'Фамилия', true);
      case 'firstName': return validateName(rawValue, 'Имя', true);
      case 'middleName': return validateName(rawValue, 'Отчество', false);
      case 'organization': return validatePlain(rawValue, 'Организация', LIMITS.organization);
      case 'position': return validatePlain(rawValue, 'Должность', LIMITS.position);
      case 'phone': return normalizePhone(rawValue).error;
      case 'email': return cleanText(rawValue) ? normalizeEmail(rawValue).error : 'Укажите e-mail';
      case 'about': return cleanMultiline(rawValue).length > LIMITS.about ? 'Не более ' + LIMITS.about + ' символов' : '';
      default:
        if (name.indexOf('social.') === 0) return normalizeSocial(name.slice(7), rawValue).error;
        return '';
    }
  }

  /** Повторная проверка ссылки прямо перед вставкой в href. */
  function safeHref(kind, url) {
    var r = normalizeSocial(kind, url);
    return r.error ? '' : r.value;
  }

  ns.validation = {
    LIMITS: LIMITS,
    SOCIAL_KEYS: SOCIAL_KEYS,
    SOCIAL_LABELS: { vk: 'ВКонтакте', telegram: 'Telegram', github: 'GitHub', linkedin: 'LinkedIn', website: 'Сайт' },
    cleanText: cleanText,
    cleanMultiline: cleanMultiline,
    normalizePhone: normalizePhone,
    formatPhone: formatPhone,
    normalizeEmail: normalizeEmail,
    parseHttpUrl: parseHttpUrl,
    normalizeSocial: normalizeSocial,
    socialHandle: socialHandle,
    validatePhoto: validatePhoto,
    emptyProfile: emptyProfile,
    sanitizeProfile: sanitizeProfile,
    validateProfile: validateProfile,
    validateField: validateField,
    safeHref: safeHref
  };
})(window.AccountAi = window.AccountAi || {});
