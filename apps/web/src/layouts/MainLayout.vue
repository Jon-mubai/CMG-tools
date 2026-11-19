<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '../stores/user';

const route = useRoute();
const router = useRouter();
const store = useUserStore();

const collapsed = ref(false);
const accountOpen = ref(false);
const expanded = ref<Record<string, boolean>>({
  work: true,
  data: true,
  wh: true,
  machine: true,
});

function toggleGroup(key: string) {
  expanded.value[key] = !expanded.value[key];
}

function isActive(page: string) {
  const map: Record<string, string> = {
    dashboard: '/',
    'machine-profit': '/machine/profit',
    'wh-docs': '/inventory/docs',
    'admin-users': '/admin/users',
  };
  const path = map[page];
  if (!path) return false;
  if (path === '/') return route.path === '/';
  return route.path === path || route.path.startsWith(path + '/');
}

function go(page: string) {
  const map: Record<string, string> = {
    dashboard: '/',
    'machine-profit': '/machine/profit',
    'wh-docs': '/inventory/docs',
    'admin-users': '/admin/users',
  };
  const path = map[page];
  if (path) {
    router.push(path);
    return;
  }
  // 未迁移页面：保持菜单可点，进入占位提示
  router.push({ name: 'home', query: { pending: page } });
}

function logout() {
  accountOpen.value = false;
  store.logout();
  router.replace({ name: 'login' });
}

function onDocClick(e: MouseEvent) {
  const t = e.target as HTMLElement;
  if (!t.closest('.sidebar-account')) accountOpen.value = false;
}

onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));

const accountLabel = computed(() => store.profile?.username || '账户');
</script>

<template>
  <div class="app-layout">
    <aside id="sidebar" class="sidebar" :class="{ collapsed }">
      <div class="sidebar-top">
        <div class="sidebar-logo">
          <span class="logo-icon" aria-hidden="true">
            <iconify-icon icon="ant-design:appstore-filled" width="18" height="18"></iconify-icon>
          </span>
          <span class="logo-text">WMS-Tec</span>
        </div>
        <button
          type="button"
          class="sidebar-collapse-btn"
          title="收起 / 展开"
          aria-label="收起或展开侧边菜单"
          @click="collapsed = !collapsed"
        >
          <iconify-icon icon="ant-design:menu-fold-outlined" width="16" height="16" class="icon-fold"></iconify-icon>
          <iconify-icon icon="ant-design:menu-unfold-outlined" width="16" height="16" class="icon-unfold"></iconify-icon>
        </button>
      </div>

      <nav class="sidebar-menu" id="sidebarMenu">
        <div class="menu-group" data-group="work">
          <button
            type="button"
            class="menu-group-head"
            :aria-expanded="expanded.work"
            @click="toggleGroup('work')"
          >
            <iconify-icon icon="ant-design:appstore-outlined" width="16" height="16"></iconify-icon>
            <span>工作台</span>
            <iconify-icon class="menu-group-arrow" icon="ant-design:down-outlined" width="12" height="12"></iconify-icon>
          </button>
          <div v-show="expanded.work" class="menu-group-body">
            <div
              class="menu-item"
              :class="{ active: isActive('dashboard') }"
              data-page="dashboard"
              @click="go('dashboard')"
            >
              <span>数据看板</span>
            </div>
            <div class="menu-item" data-page="scan" title="数据导入 + 扫码录入实盘" @click="go('scan')">
              <span>扫码盘点</span>
            </div>
          </div>
        </div>

        <div class="menu-group" data-group="data">
          <button
            type="button"
            class="menu-group-head"
            :aria-expanded="expanded.data"
            @click="toggleGroup('data')"
          >
            <iconify-icon icon="ant-design:database-outlined" width="16" height="16"></iconify-icon>
            <span>数据</span>
            <iconify-icon class="menu-group-arrow" icon="ant-design:down-outlined" width="12" height="12"></iconify-icon>
          </button>
          <div v-show="expanded.data" class="menu-group-body">
            <div class="menu-item" data-page="scan-data" title="盘点明细 / 账面 / 报告 / 比对" @click="go('scan-data')">
              <span>盘点数据</span>
            </div>
          </div>
        </div>

        <div class="menu-group" data-group="wh">
          <button
            type="button"
            class="menu-group-head"
            :aria-expanded="expanded.wh"
            @click="toggleGroup('wh')"
          >
            <iconify-icon icon="ant-design:home-outlined" width="16" height="16"></iconify-icon>
            <span>仓库管理</span>
            <iconify-icon class="menu-group-arrow" icon="ant-design:down-outlined" width="12" height="12"></iconify-icon>
          </button>
          <div v-show="expanded.wh" class="menu-group-body">
            <div class="menu-item" data-page="wh-park" title="仓库可视化" @click="go('wh-park')">
              <span>仓库可视化</span>
            </div>
            <div class="menu-item" data-page="wh-stock" title="库存管理" @click="go('wh-stock')">
              <span>库存管理</span>
            </div>
            <div
              class="menu-item"
              :class="{ active: isActive('wh-docs') }"
              data-page="wh-docs"
              title="单据设置"
              @click="go('wh-docs')"
            >
              <span>单据设置</span>
            </div>
          </div>
        </div>

        <div class="menu-group" data-group="machine">
          <button
            type="button"
            class="menu-group-head"
            :aria-expanded="expanded.machine"
            @click="toggleGroup('machine')"
          >
            <iconify-icon icon="ant-design:desktop-outlined" width="16" height="16"></iconify-icon>
            <span>机台数据</span>
            <iconify-icon class="menu-group-arrow" icon="ant-design:down-outlined" width="12" height="12"></iconify-icon>
          </button>
          <div v-show="expanded.machine" class="menu-group-body">
            <div
              class="menu-item"
              :class="{ active: isActive('machine-profit') }"
              data-page="machine-profit"
              title="周/月毛利 · 数据源导入"
              @click="go('machine-profit')"
            >
              <span>机台毛利</span>
            </div>
            <div class="menu-item" data-page="machine-ops" title="机台运营数据" @click="go('machine-ops')">
              <span>运营数据</span>
            </div>
            <div class="menu-item" data-page="machine-category" title="品类统计" @click="go('machine-category')">
              <span>品类统计</span>
            </div>
          </div>
        </div>
      </nav>

      <div class="sidebar-bottom">
        <div
          v-show="store.isAdmin"
          class="menu-item menu-item-quiet"
          :class="{ active: isActive('admin-users') }"
          data-page="admin-users"
          title="账号与权限"
          @click="go('admin-users')"
        >
          <iconify-icon class="menu-icon" icon="ant-design:team-outlined" width="16" height="16"></iconify-icon>
          <span>账号与权限</span>
        </div>
        <div class="menu-item menu-item-quiet" data-page="help" title="系统说明" @click="go('help')">
          <iconify-icon class="menu-icon" icon="ant-design:question-circle-outlined" width="16" height="16"></iconify-icon>
          <span>帮助</span>
        </div>

        <div class="sidebar-account" id="sidebarAccount">
          <button
            type="button"
            class="sidebar-account-btn"
            id="sidebarAccountBtn"
            :aria-expanded="accountOpen"
            @click.stop="accountOpen = !accountOpen"
          >
            <iconify-icon class="menu-icon" icon="ant-design:user-outlined" width="16" height="16"></iconify-icon>
            <span class="account-label" id="accountLabel">{{ accountLabel }}</span>
            <iconify-icon class="account-caret" icon="ant-design:up-outlined" width="12" height="12"></iconify-icon>
          </button>
          <div class="sidebar-account-panel" id="sidebarAccountPanel" :hidden="!accountOpen">
            <div class="account-email">{{ store.profile?.username || '—' }}</div>
            <div class="account-hint">
              {{ store.profile?.role === 'admin' ? '管理员' : '用户' }} · 智能盘点系统
            </div>
            <div class="account-actions">
              <button type="button" class="account-action account-action-danger" id="btnLogout" @click="logout">
                退出登录
              </button>
            </div>
          </div>
        </div>

        <div class="sidebar-credit" title="系统由 MuBai 提供技术支持">
          系统由
          <a
            class="sidebar-credit-link"
            href="https://github.com/Jon-mubai/CMG-tools"
            target="_blank"
            rel="noopener noreferrer"
            >MuBai</a
          >
          提供支持
        </div>
      </div>
    </aside>

    <div class="sidebar-overlay" id="sidebarOverlay" @click="collapsed = false"></div>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>
