<script setup lang="ts">
import { useUserStore } from '../stores/user';
const store = useUserStore();
</script>

<template>
  <div class="page-dashboard">
    <header class="page-head">
      <h1 class="page-title">数据看板</h1>
      <p class="page-desc">
        欢迎，{{ store.profile?.username }}
        <span class="role-tag">{{ store.profile?.role === 'admin' ? '管理员' : '用户' }}</span>
      </p>
    </header>

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-label">架构</div>
        <div class="stat-value">Vue 3 + NestJS</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">数据</div>
        <div class="stat-value">PostgreSQL</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">视觉</div>
        <div class="stat-value">cucumber 侧栏体系</div>
      </div>
    </div>

    <div class="panel">
      <h2 class="panel-title">快捷入口</h2>
      <div class="quick-grid">
        <router-link class="quick-item" to="/machine/profit">
          <iconify-icon icon="ant-design:line-chart-outlined" width="22" height="22"></iconify-icon>
          <span>机台毛利</span>
        </router-link>
        <router-link class="quick-item" to="/inventory/docs">
          <iconify-icon icon="ant-design:file-text-outlined" width="22" height="22"></iconify-icon>
          <span>库存单据</span>
        </router-link>
        <router-link v-if="store.isAdmin" class="quick-item" to="/admin/users">
          <iconify-icon icon="ant-design:team-outlined" width="22" height="22"></iconify-icon>
          <span>账号与权限</span>
        </router-link>
      </div>
      <p class="note">
        侧栏与配色已恢复为旧版 cucumber 设计体系；扫码盘点、3D 仓库等完整业务页将按同一视觉逐步迁回 Vue。
      </p>
    </div>
  </div>
</template>

<style scoped>
.page-head { margin-bottom: 20px; }
.page-title { margin: 0 0 6px; font-size: 22px; font-weight: 700; }
.page-desc { margin: 0; color: #737373; font-size: 14px; }
.role-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f4f4f5;
  font-size: 12px;
  color: #525252;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 16px;
}
.stat-label { font-size: 12px; color: #737373; margin-bottom: 6px; }
.stat-value { font-size: 16px; font-weight: 600; }
.panel {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 18px;
}
.panel-title { margin: 0 0 12px; font-size: 15px; }
.quick-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.quick-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #eee;
  color: #171717;
  font-size: 13px;
  background: #fafafa;
}
.quick-item:hover { border-color: #d4d4d4; background: #fff; }
.note { margin: 16px 0 0; font-size: 12px; color: #a3a3a3; line-height: 1.5; }
@media (max-width: 720px) {
  .stat-row { grid-template-columns: 1fr; }
}
</style>
