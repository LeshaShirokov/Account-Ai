/**
 * Inline SVG-иконки. Создаются через createElementNS, без парсинга HTML-строк.
 */
(function (ns) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function p(d) { return ['path', { d: d }]; }
  function c(cx, cy, r) { return ['circle', { cx: cx, cy: cy, r: r }]; }
  function r(x, y, w, h, rx) { return ['rect', { x: x, y: y, width: w, height: h, rx: rx || 0 }]; }

  var ICONS = {
    // Контурные иконки (stroke)
    moon: { els: [p('M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z')] },
    sun: { els: [c(12, 12, 4), p('M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41')] },
    edit: { els: [p('M12 20h9'), p('M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z')] },
    user: { els: [c(12, 8, 4), p('M4 21a8 8 0 0 1 16 0')] },
    contact: { els: [r(3, 4, 18, 16, 2), c(9, 10, 2), p('M15 9h2M15 13h2M6 16.5a3 3 0 0 1 6 0')] },
    link: { els: [p('M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'), p('M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71')] },
    database: { els: [['ellipse', { cx: 12, cy: 5, rx: 9, ry: 3 }], p('M3 5v14a9 3 0 0 0 18 0V5'), p('M3 12a9 3 0 0 0 18 0')] },
    download: { els: [p('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), p('M7 10l5 5 5-5'), p('M12 15V3')] },
    upload: { els: [p('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), p('M17 8l-5-5-5 5'), p('M12 3v12')] },
    reset: { els: [p('M3 12a9 9 0 1 0 3-6.7L3 8'), p('M3 3v5h5')] },
    camera: { els: [p('M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'), c(12, 13, 3)] },
    trash: { els: [p('M3 6h18'), p('M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'), p('M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'), p('M10 11v6M14 11v6')] },
    check: { els: [p('M20 6 9 17l-5-5')] },
    x: { els: [p('M18 6 6 18M6 6l12 12')] },
    phone: { els: [p('M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z')] },
    mail: { els: [r(2, 4, 20, 16, 2), p('m22 7-10 6L2 7')] },
    building: { els: [r(4, 2, 16, 20, 2), p('M9 22v-4h6v4'), p('M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01')] },
    briefcase: { els: [r(2, 7, 20, 14, 2), p('M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16')] },
    globe: { els: [c(12, 12, 10), p('M2 12h20'), p('M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z')] },
    external: { els: [p('M15 3h6v6'), p('M10 14 21 3'), p('M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6')] },
    copy: { els: [r(9, 9, 13, 13, 2), p('M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1')] },
    alert: { els: [c(12, 12, 10), p('M12 8v4M12 16h.01')] },

    // Логотипы (заливка)
    github: {
      fill: true, vb: '0 0 16 16',
      els: [p('M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z')]
    },
    telegram: {
      fill: true,
      els: [c(12, 12, 12), ['path', { d: 'M5.4 11.75 17.1 7.2c.54-.2 1.02.13.84.95l-2 9.4c-.15.66-.55.82-1.1.51l-3.05-2.25-1.47 1.42c-.16.16-.3.3-.62.3l.22-3.1 5.62-5.08c.25-.22-.05-.34-.38-.12l-6.95 4.38-3-.94c-.65-.2-.66-.65.14-.97z', 'class': 'icon-inv' }]]
    },
    vk: {
      fill: true,
      els: [r(0, 0, 24, 24, 6), ['path', { d: 'M12.77 16.8c-5.13 0-8.05-3.52-8.17-9.37h2.57c.08 4.3 1.98 6.12 3.48 6.5V7.43h2.42v3.71c1.48-.16 3.04-1.85 3.56-3.71h2.42c-.4 2.29-2.09 3.98-3.29 4.67 1.2.56 3.12 2.03 3.85 4.7h-2.66c-.57-1.79-2-3.17-3.88-3.36v3.36z', 'class': 'icon-inv' }]]
    },
    linkedin: {
      fill: true,
      els: [r(0, 0, 24, 24, 4),
        ['circle', { cx: 7.3, cy: 7.2, r: 1.55, 'class': 'icon-inv' }],
        ['rect', { x: 5.95, y: 9.6, width: 2.7, height: 8.4, 'class': 'icon-inv' }],
        ['path', { d: 'M10.6 9.6h2.6v1.15c.4-.72 1.34-1.35 2.72-1.35 2.73 0 3.23 1.75 3.23 4.03V18h-2.7v-4.1c0-.98-.02-2.24-1.37-2.24-1.37 0-1.58 1.07-1.58 2.17V18h-2.7z', 'class': 'icon-inv' }]]
    }
  };

  /**
   * Создаёт SVG-элемент иконки.
   * @param {string} name
   * @param {{size?: number, className?: string, title?: string}} [opts]
   * @returns {SVGSVGElement}
   */
  function createIcon(name, opts) {
    opts = opts || {};
    var spec = ICONS[name] || ICONS.alert;
    var svg = document.createElementNS(SVG_NS, 'svg');
    var size = opts.size || 20;
    svg.setAttribute('viewBox', spec.vb || '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('class', 'icon icon--' + name + (opts.className ? ' ' + opts.className : ''));
    svg.setAttribute('focusable', 'false');
    if (spec.fill) {
      svg.setAttribute('fill', 'currentColor');
    } else {
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
    }
    if (opts.title) {
      svg.setAttribute('role', 'img');
      var t = document.createElementNS(SVG_NS, 'title');
      t.textContent = opts.title;
      svg.appendChild(t);
    } else {
      svg.setAttribute('aria-hidden', 'true');
    }
    spec.els.forEach(function (el) {
      var node = document.createElementNS(SVG_NS, el[0]);
      Object.keys(el[1]).forEach(function (k) { node.setAttribute(k, String(el[1][k])); });
      svg.appendChild(node);
    });
    return svg;
  }

  /** Заполняет все элементы [data-icon] внутри root соответствующими иконками. */
  function hydrate(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (slot) {
      var name = slot.getAttribute('data-icon');
      slot.setAttribute('aria-hidden', 'true');
      while (slot.firstChild) slot.removeChild(slot.firstChild);
      slot.appendChild(createIcon(name, { size: Number(slot.getAttribute('data-icon-size')) || 18 }));
    });
  }

  ns.icons = { create: createIcon, hydrate: hydrate, names: Object.keys(ICONS) };
})(window.AccountAi = window.AccountAi || {});
