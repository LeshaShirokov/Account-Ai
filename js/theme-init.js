/* Ранняя установка темы до отрисовки страницы, чтобы не было «вспышки». */
(function () {
  'use strict';
  var theme = 'light';
  try {
    var saved = window.localStorage.getItem('account-ai.theme');
    if (saved === 'light' || saved === 'dark') {
      theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    }
  } catch (e) { /* localStorage недоступен — остаёмся на светлой теме */ }
  document.documentElement.setAttribute('data-theme', theme);
})();
