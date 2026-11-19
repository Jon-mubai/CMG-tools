/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/core/sidebar.js — 侧边栏：移动端抽屉 · 折叠 · 搜索 · 账户 */
  var sidebar = $('sidebar');
  var overlay = $('sidebarOverlay');
  function openSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('show');
  }
  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
  }
  var menuToggle = $('menuToggle');
  if (menuToggle) menuToggle.addEventListener('click', openSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  /* 折叠 / 展开（图标栏） */
  var sidebarToggleBtn = $('sidebarToggle');
  function toggleSidebar() {
    if (!sidebar) return;
    var collapsed = sidebar.classList.toggle('collapsed');
    sidebar.setAttribute('data-collapsed', collapsed ? '1' : '0');
    if (sidebarToggleBtn) {
      sidebarToggleBtn.setAttribute('aria-label', collapsed ? '展开侧边菜单' : '收起侧边菜单');
      sidebarToggleBtn.setAttribute('title', collapsed ? '展开' : '收起');
      sidebarToggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
    /* 从收起恢复时，确保一级标题节点可见（清可能被搜索写下的 display） */
    if (!collapsed) {
      document.querySelectorAll('#sidebarMenu .menu-group').forEach(function (grp) {
        if (grp.style.display === 'none' && !document.getElementById('sidebarSearch').value) {
          grp.style.display = '';
        }
      });
      document.querySelectorAll('#sidebarMenu .menu-item').forEach(function (it) {
        if (it.style.display === 'none' && !(document.getElementById('sidebarSearch') || {}).value) {
          it.style.display = '';
        }
      });
    }
  }
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleSidebar();
    });
  }

  /* 菜单搜索过滤：仅点击搜索按钮触发 */
  function applySidebarSearch() {
    var searchInput = $('sidebarSearch');
    var q = searchInput ? (searchInput.value || '').trim().toLowerCase() : '';
    document.querySelectorAll('#sidebarMenu .menu-item').forEach(function (item) {
      var text = (item.textContent || '').toLowerCase();
      var show = !q || text.indexOf(q) >= 0;
      item.style.display = show ? '' : 'none';
    });
    document.querySelectorAll('#sidebarMenu .menu-group').forEach(function (grp) {
      var visible = Array.prototype.some.call(grp.querySelectorAll('.menu-item'), function (it) {
        return it.style.display !== 'none';
      });
      grp.style.display = visible || !q ? '' : 'none';
      if (q && visible) {
        var head = grp.querySelector('.menu-group-head');
        if (head) {
          head.setAttribute('aria-expanded', 'true');
          grp.classList.remove('collapsed');
        }
      }
    });
  }
  var searchInput = $('sidebarSearch');
  var btnSidebarSearch = $('btnSidebarSearch');
  if (btnSidebarSearch) {
    btnSidebarSearch.addEventListener('click', function (e) {
      e.preventDefault();
      applySidebarSearch();
    });
  }
  if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        applySidebarSearch();
      }
    });
  }

  /* 底部账户展开 */
  var accBtn = $('sidebarAccountBtn');
  var accPanel = $('sidebarAccountPanel');
  if (accBtn && accPanel) {
    accBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = accBtn.getAttribute('aria-expanded') === 'true';
      if (open) {
        accBtn.setAttribute('aria-expanded', 'false');
        accPanel.setAttribute('hidden', '');
        accPanel.hidden = true;
        accPanel.style.display = 'none';
      } else {
        accBtn.setAttribute('aria-expanded', 'true');
        accPanel.removeAttribute('hidden');
        accPanel.hidden = false;
        accPanel.style.display = '';
      }
    });
    /* 点击页面其它区域收起 */
    document.addEventListener('click', function (e) {
      if (!accPanel || accPanel.hidden) return;
      var root = $('sidebarAccount');
      if (root && root.contains(e.target)) return;
      accBtn.setAttribute('aria-expanded', 'false');
      accPanel.setAttribute('hidden', '');
      accPanel.hidden = true;
      accPanel.style.display = 'none';
    });
  }
