/*
 * 作者：zcl（沐白）
 * 时间：2026-10-14
 * 职位：全栈开发
 * 离线图标：加载本地 ant-design 集合，禁用远程 Iconify API
 */
(function () {
  'use strict';
  var url = (document.currentScript && document.currentScript.getAttribute('data-icons')) || 'vendor/icons-ant-design.json';

  function apply(data) {
    var api = window.Iconify || window.IconifyIcon || null;
    if (api && typeof api.addCollection === 'function') {
      api.addCollection(data);
      return;
    }
    /* iconify-icon 自定义元素：通过全局队列预载 */
    window.IconifyProviders = window.IconifyProviders || {};
    /* 阻止默认 api.iconify.design */
    try {
      if (api && typeof api.addAPIProvider === 'function') {
        api.addAPIProvider('', { resources: [] });
      }
    } catch (e) {}
    window.__ICONIFY_LOCAL__ = data;
    if (api && typeof api.loadIcons === 'function') return;
    /* 兜底：把 body 写进自定义元素属性不现实；依赖 addCollection 时机 */
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var a = window.Iconify || window.IconifyIcon;
      if (a && typeof a.addCollection === 'function') {
        a.addCollection(data);
        clearInterval(t);
      } else if (tries > 40) clearInterval(t);
    }, 50);
  }

  fetch(url, { credentials: 'same-origin', cache: 'force-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('icons http ' + r.status);
      return r.json();
    })
    .then(apply)
    .catch(function (e) {
      console.warn('[iconify-offline]', e);
    });
})();
