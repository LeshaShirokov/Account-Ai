/* Тесты на jsdom: node tests/profile.test.js (нужен пакет jsdom). */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCRIPTS = ['theme-init', 'icons', 'validation', 'storage', 'photo', 'ui', 'render', 'editor', 'app'];

const windows = [];
function boot(preset) {
  const dom = new JSDOM(html, { url: 'https://example.test/', pretendToBeVisual: true, runScripts: 'outside-only' });
  const w = dom.window;
  windows.push(w);
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.scrollTo = () => {};
  w.confirm = () => true;
  if (preset) preset(w);
  for (const s of SCRIPTS) w.eval(fs.readFileSync(path.join(ROOT, 'js', s + '.js'), 'utf8'));
  if (w.document.readyState === 'loading') {
    return new Promise(resolve => w.document.addEventListener('DOMContentLoaded', () => resolve(w)));
  }
  return Promise.resolve(w);
}

let passed = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); passed++; results.push('  ✓ ' + name); }
  catch (e) { results.push('  ✗ ' + name + '\n    ' + (e && e.stack || e)); process.exitCode = 1; }
}

(async () => {
  const w = await boot();
  const V = w.AccountAi.validation;
  const S = w.AccountAi.storage;

  await test('нормализация телефона', () => {
    assert.strictEqual(V.normalizePhone('8 (900) 123-45-67').value, '+79001234567');
    assert.strictEqual(V.normalizePhone('+7 900 123 45 67').value, '+79001234567');
    assert.strictEqual(V.normalizePhone('9001234567').value, '+79001234567');
    assert.strictEqual(V.normalizePhone('79001234567').value, '+79001234567');
    assert.strictEqual(V.normalizePhone('').value, '');
    assert.ok(V.normalizePhone('+1 202 555 0100').error);
    assert.ok(V.normalizePhone('12345').error);
    assert.ok(V.normalizePhone('8900abc4567').error);
    assert.ok(V.normalizePhone('+7 100 123 45 67').error);
    assert.strictEqual(V.formatPhone('+79001234567'), '+7 (900) 123-45-67');
  });

  await test('e-mail', () => {
    assert.strictEqual(V.normalizeEmail(' Anna.K@Example.COM ').value, 'anna.k@example.com');
    for (const bad of ['anna', 'a@b', 'a@@b.ru', '.a@b.ru', 'a..b@c.ru', 'a@b..ru', 'a b@c.ru', '<x>@y.ru']) {
      assert.ok(V.normalizeEmail(bad).error, bad);
    }
  });

  await test('ФИО', () => {
    assert.strictEqual(V.validateField('lastName', 'Римский-Корсаков'), '');
    assert.strictEqual(V.validateField('firstName', "O'Brien"), '');
    assert.ok(V.validateField('lastName', ''));
    assert.ok(V.validateField('firstName', 'Анна1'));
    assert.ok(V.validateField('firstName', '<img src=x>'));
    assert.strictEqual(V.validateField('middleName', ''), '');
  });

  await test('ссылки соцсетей', () => {
    const ok = (k, v, exp) => { const r = V.normalizeSocial(k, v); assert.strictEqual(r.error, '', k + ' ' + v + ': ' + r.error); assert.strictEqual(r.value, exp); };
    const bad = (k, v) => assert.ok(V.normalizeSocial(k, v).error, k + ' ' + v);
    ok('vk', 'https://vk.com/durov', 'https://vk.com/durov');
    ok('vk', 'm.vk.com/id1', 'https://vk.com/id1');
    ok('telegram', '@anna_demo', 'https://t.me/anna_demo');
    ok('telegram', 'anna_demo', 'https://t.me/anna_demo');
    ok('telegram', 'https://telegram.me/anna_demo/', 'https://t.me/anna_demo');
    ok('github', 'http://github.com/octocat', 'https://github.com/octocat');
    ok('linkedin', 'https://ru.linkedin.com/in/anna-demo', 'https://www.linkedin.com/in/anna-demo');
    ok('website', 'example.org/path?q=1', 'https://example.org/path?q=1');
    bad('vk', 'javascript:alert(1)');
    bad('website', 'javascript:alert(1)');
    bad('website', 'JaVaScRiPt:alert(1)');
    bad('website', 'data:text/html,<script>alert(1)</script>');
    bad('website', 'ftp://example.com');
    bad('website', 'https://user:pass@example.com');
    bad('website', '//evil.com');
    bad('website', 'https://localhost');
    bad('vk', 'https://vk.com.evil.com/durov');
    bad('vk', 'https://evil.com/vk.com/durov');
    bad('telegram', '@abc');
    bad('telegram', '@1abcdef');
    bad('github', 'https://github.com/-bad-');
    bad('github', 'https://github.com/a/b');
    bad('linkedin', 'https://linkedin.com.evil.io/in/x');
    bad('linkedin', 'https://www.linkedin.com/feed');
  });

  await test('сохранение и загрузка', () => {
    w.localStorage.clear();
    assert.strictEqual(S.load().source, 'demo');
    const p = S.demoProfile();
    p.phone = '8 912 000 11 22';
    p.social.telegram = '@new_handle';
    const res = S.save(p);
    assert.strictEqual(res.profile.phone, '+79120001122');
    const loaded = S.load();
    assert.strictEqual(loaded.source, 'stored');
    assert.strictEqual(loaded.profile.social.telegram, 'https://t.me/new_handle');
    assert.ok(loaded.updatedAt);
    w.localStorage.setItem(S.KEY, '{not json');
    assert.strictEqual(S.load().source, 'corrupt');
    w.localStorage.setItem(S.KEY, JSON.stringify({ profile: Object.assign(S.demoProfile(), { social: { website: 'javascript:alert(1)' } }) }));
    assert.strictEqual(S.load().source, 'corrupt');
    assert.throws(() => S.save(Object.assign(S.demoProfile(), { email: 'bad' })), e => !!(e.fieldErrors && e.fieldErrors.email));
    w.localStorage.clear();
  });

  await test('экспорт и импорт JSON', () => {
    const json = S.exportJson(S.demoProfile());
    const data = JSON.parse(json);
    assert.strictEqual(data.format, 'account-ai-profile');
    const imp = S.importJson(json);
    assert.ok(imp.ok, imp.errors.join());
    assert.deepStrictEqual(JSON.parse(JSON.stringify(imp.profile)), data.profile);
    // Лишние поля отбрасываются, прототип не загрязняется
    const extra = S.importJson(JSON.stringify(Object.assign(S.demoProfile(), { isAdmin: true, __proto__: { polluted: 1 }, social: Object.assign(S.demoProfile().social, { evil: 'x' }) })));
    assert.ok(extra.ok);
    assert.strictEqual(extra.profile.isAdmin, undefined);
    assert.strictEqual(extra.profile.social.evil, undefined);
    assert.strictEqual({}.polluted, undefined);
    // Ошибки
    assert.ok(!S.importJson('nope').ok);
    assert.ok(!S.importJson('[]').ok);
    assert.ok(!S.importJson(JSON.stringify({ format: 'other' })).ok);
    assert.ok(!S.importJson(JSON.stringify(Object.assign(S.demoProfile(), { social: { github: 'javascript:alert(1)' } }))).ok);
    assert.ok(!S.importJson(JSON.stringify(Object.assign(S.demoProfile(), { photo: 'data:image/svg+xml;base64,PHN2Zz4=' }))).ok);
    assert.ok(!S.importJson(JSON.stringify(Object.assign(S.demoProfile(), { firstName: '<script>' }))).ok);
    // Санитизация: управляющие символы и лишние пробелы
    const dirty = S.importJson(JSON.stringify(Object.assign(S.demoProfile(), { organization: '  ООО\u0000  «Тест»\u202E  ', firstName: 42 })));
    assert.ok(!dirty.ok); // firstName — число → строка "42" не проходит проверку имени
    const dirty2 = S.importJson(JSON.stringify(Object.assign(S.demoProfile(), { organization: '  ООО\u0000  «Тест»\u202E  ' })));
    assert.ok(dirty2.ok);
    assert.strictEqual(dirty2.profile.organization, 'ООО «Тест»');
  });

  await test('XSS: данные выводятся как текст', async () => {
    w.localStorage.clear();
    const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
    const p = Object.assign(S.demoProfile(), { about: payload + '\n\nвторой абзац', position: 'Dev "quotes" & amp' });
    S.save(p);
    const w2 = await boot(win => win.localStorage.setItem(S.KEY, w.localStorage.getItem(S.KEY)));
    const about = w2.document.getElementById('profile-about');
    assert.strictEqual(about.querySelectorAll('img,script').length, 0);
    assert.ok(about.textContent.includes('<img src=x'));
    assert.strictEqual(about.querySelectorAll('p').length, 2);
    assert.strictEqual(w2.__xss, undefined);
    // Организация с угловыми скобками отклоняется валидацией
    assert.ok(V.validateField('organization', '<b>x</b>'));
  });

  await test('ссылки: rel, target, только https/http', async () => {
    const w3 = await boot();
    const links = w3.document.querySelectorAll('#profile-social a');
    assert.strictEqual(links.length, 5);
    links.forEach(a => {
      assert.strictEqual(a.getAttribute('rel'), 'noopener noreferrer nofollow');
      assert.strictEqual(a.getAttribute('target'), '_blank');
      assert.ok(/^https?:\/\//.test(a.getAttribute('href')));
    });
    assert.ok(w3.document.querySelector('#profile-contacts a[href="tel:+79001234567"]'));
    assert.ok(w3.document.querySelector('#profile-avatar .avatar__initials').textContent === 'АК');
    assert.ok(w3.document.querySelectorAll('svg.icon').length > 10);
  });

  await test('форма: ошибки, сохранение, отмена', async () => {
    const w4 = await boot(win => win.localStorage.clear());
    const d = w4.document;
    d.getElementById('edit-btn').click();
    assert.strictEqual(d.getElementById('view-edit').hidden, false);
    assert.strictEqual(d.getElementById('f-phone').value, '+7 (900) 123-45-67');
    assert.strictEqual(d.getElementById('f-telegram').value, '@anna_kovaleva_demo');
    const email = d.getElementById('f-email');
    email.value = 'не почта';
    email.dispatchEvent(new w4.Event('input', { bubbles: true }));
    d.getElementById('f-website').value = 'javascript:alert(1)';
    d.getElementById('profile-form').dispatchEvent(new w4.Event('submit', { cancelable: true, bubbles: true }));
    assert.strictEqual(email.getAttribute('aria-invalid'), 'true');
    assert.ok(d.getElementById('e-email').textContent.length > 0);
    assert.ok(d.getElementById('e-website').textContent.includes('http'));
    assert.strictEqual(d.activeElement, email);
    assert.strictEqual(w4.localStorage.getItem(w4.AccountAi.storage.KEY), null);
    assert.ok(w4.AccountAi.app.editor.isDirty());
    // исправляем
    email.value = 'New@Mail.RU';
    d.getElementById('f-website').value = '';
    d.getElementById('f-phone').value = '89995554433';
    d.getElementById('f-firstName').value = 'Мария';
    d.getElementById('profile-form').dispatchEvent(new w4.Event('submit', { cancelable: true, bubbles: true }));
    const stored = JSON.parse(w4.localStorage.getItem(w4.AccountAi.storage.KEY));
    assert.strictEqual(stored.profile.email, 'new@mail.ru');
    assert.strictEqual(stored.profile.phone, '+79995554433');
    assert.strictEqual(stored.profile.social.website, '');
    assert.strictEqual(d.getElementById('view-profile').hidden, false);
    assert.ok(d.getElementById('profile-name').textContent.includes('Мария'));
    assert.ok([...d.querySelectorAll('.toast')].some(t => t.textContent.includes('Профиль сохранён')));
    // отмена с изменениями → подтверждение (window.confirm в jsdom)
    d.getElementById('edit-btn').click();
    d.getElementById('f-lastName').value = 'Другая';
    let asked = false;
    w4.confirm = () => { asked = true; return true; };
    await w4.AccountAi.app.editor.requestClose();
    assert.ok(asked);
    assert.strictEqual(d.getElementById('view-edit').hidden, true);
    assert.ok(!d.getElementById('profile-name').textContent.includes('Другая'));
  });

  await test('фото: проверка файла и кадрирование', () => {
    const P = w.AccountAi.photo;
    assert.ok(P.validateFile({ type: 'image/svg+xml', size: 100 }));
    assert.ok(P.validateFile({ type: 'image/png', size: 6 * 1024 * 1024 }));
    assert.strictEqual(P.validateFile({ type: 'image/jpeg', size: 1024 }), '');
    assert.deepStrictEqual({ ...P.squareCrop(1600, 900, 512) }, { sx: 350, sy: 0, side: 900, out: 512 });
    assert.deepStrictEqual({ ...P.squareCrop(200, 300, 512) }, { sx: 0, sy: 50, side: 200, out: 200 });
    assert.ok(V.validatePhoto('data:image/png;base64,<script>'));
    assert.strictEqual(V.validatePhoto('data:image/jpeg;base64,AAAA'), '');
  });

  await test('тема сохраняется в localStorage', async () => {
    const w5 = await boot(win => win.localStorage.clear());
    const btn = w5.document.getElementById('theme-toggle');
    assert.strictEqual(w5.document.documentElement.getAttribute('data-theme'), 'light');
    btn.click();
    assert.strictEqual(w5.document.documentElement.getAttribute('data-theme'), 'dark');
    assert.strictEqual(w5.localStorage.getItem('account-ai.theme'), 'dark');
    assert.strictEqual(btn.getAttribute('aria-pressed'), 'true');
    const w6 = await boot(win => win.localStorage.setItem('account-ai.theme', 'dark'));
    assert.strictEqual(w6.document.documentElement.getAttribute('data-theme'), 'dark');
  });

  await test('в коде нет innerHTML / insertAdjacentHTML / document.write', () => {
    for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
      const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
      assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(src), f);
    }
  });

  console.log(results.join('\n'));
  windows.forEach(x => x.close());
  console.log(`\n${passed}/${results.length} тестов пройдено`);
})();
