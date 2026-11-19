/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/features/scan-nav.js */
/* ===== 盘点数据页：全局导航（切换三个独立子页，路径唯一） ===== */
  (function initGlobalNav() {
    var nav = $('globalNav');
    if (!nav) return;
    var topbar = document.querySelector('.topbar');
    /* 动态测量顶栏高度，写入 CSS 变量供 sticky 定位使用 */
    function measureTopbar() {
      if (!topbar) return;
      document.documentElement.style.setProperty('--topbar-h', topbar.offsetHeight + 'px');
    }
    measureTopbar();
    window.addEventListener('resize', measureTopbar);
    var links = nav.querySelectorAll('.gn-link');
    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var view = a.getAttribute('data-view');
        if (SCAN_VIEWS.indexOf(view) === -1) return;
        /* 立即高亮，切页渲染由 hashchange 统一处理 */
        for (var k = 0; k < links.length; k++) {
          links[k].classList.toggle('active', links[k] === a);
        }
        var next = '#/scan-data/' + view;
        if (location.hash === next) applyScanView(view);
        else location.hash = next;
      });
    });
  })();
