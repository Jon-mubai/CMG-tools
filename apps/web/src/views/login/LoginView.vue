<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../../stores/user';

const username = ref('');
const password = ref('');
const err = ref('');
const loading = ref(false);
const tab = ref<'login' | 'contact'>('login');
const store = useUserStore();
const router = useRouter();

async function submit() {
  err.value = '';
  if (!username.value.trim() || !password.value) {
    err.value = '请输入账号和密码';
    return;
  }
  loading.value = true;
  try {
    await store.login(username.value.trim(), password.value);
    await router.replace({ name: 'home' });
  } catch (e: any) {
    const m = e.response?.data?.message;
    err.value = Array.isArray(m) ? m.join('; ') : m || e.message || '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <!-- 与旧版 frontend/index.html #authGate 结构一致，样式来自 30-pages-auth.css -->
  <div class="auth-gate is-open" id="authGate">
    <div class="auth-shell">
      <div class="auth-pane auth-pane-brand">
        <div class="auth-brand-top">
          <div class="auth-brand-logo">
            <span class="auth-brand-icon" aria-hidden="true">
              <iconify-icon icon="ant-design:appstore-filled" width="18" height="18"></iconify-icon>
            </span>
            <span class="auth-brand-name">Warehouse Management</span>
          </div>
        </div>
        <div class="auth-banner auth-banner-3d" aria-hidden="true">
          <div class="wm-decor">
            <span class="wm-ring wm-ring-a"></span>
            <span class="wm-ring wm-ring-b"></span>
            <span class="wm-slash wm-slash-a"></span>
            <span class="wm-slash wm-slash-b"></span>
            <span class="wm-blob wm-blob-a"></span>
            <span class="wm-blob wm-blob-b"></span>
          </div>
          <div class="wm-scene">
            <div class="wm-floor"></div>
            <div class="wm-glow"></div>
            <div class="wm-stack">
              <div class="wm-tote wm-t1">
                <div class="wm-face wm-top"></div>
                <div class="wm-face wm-front">
                  <span class="wm-handle"></span>
                  <span class="wm-handle wm-h2"></span>
                  <span class="wm-label">BIN</span>
                </div>
                <div class="wm-face wm-side"></div>
              </div>
              <div class="wm-tote wm-t2">
                <div class="wm-face wm-top"></div>
                <div class="wm-face wm-front">
                  <span class="wm-handle"></span>
                  <span class="wm-handle wm-h2"></span>
                  <span class="wm-label">BIN</span>
                </div>
                <div class="wm-face wm-side"></div>
              </div>
              <div class="wm-tote wm-t3">
                <div class="wm-face wm-top"></div>
                <div class="wm-face wm-front">
                  <span class="wm-handle"></span>
                  <span class="wm-handle wm-h2"></span>
                  <span class="wm-label">BIN</span>
                </div>
                <div class="wm-face wm-side"></div>
              </div>
            </div>
            <div class="wm-spill">
              <span class="wm-item i1"></span>
              <span class="wm-item i2"></span>
              <span class="wm-item i3"></span>
              <span class="wm-item i4"></span>
              <span class="wm-item i5"></span>
              <span class="wm-item i6"></span>
              <span class="wm-item i7"></span>
              <span class="wm-item i8"></span>
            </div>
            <div class="wm-tote wm-side-tote st1">
              <div class="wm-face wm-top"></div>
              <div class="wm-face wm-front"><span class="wm-handle"></span><span class="wm-handle wm-h2"></span></div>
              <div class="wm-face wm-side"></div>
            </div>
            <div class="wm-tote wm-side-tote st2">
              <div class="wm-face wm-top"></div>
              <div class="wm-face wm-front"><span class="wm-handle"></span><span class="wm-handle wm-h2"></span></div>
              <div class="wm-face wm-side"></div>
            </div>
          </div>
        </div>
        <div class="auth-pane-foot">
          © 2026 WMS Cloud · 隐私政策<span class="auth-pane-foot-sep"> · </span>系统由 MuBai 提供技术支持
        </div>
      </div>

      <div class="auth-pane auth-pane-form">
        <div class="auth-form-header">
          <h2 class="auth-form-title">登录 WMS-Tec</h2>
          <p class="auth-form-lead">智能仓储管理平台，支持盘点协同、库存管控与权限分配</p>
        </div>
        <div class="auth-tabs">
          <button type="button" :class="{ active: tab === 'login' }" @click="tab = 'login'">账号登录</button>
          <button type="button" :class="{ active: tab === 'contact' }" @click="tab = 'contact'">联系管理员</button>
        </div>

        <div v-show="tab === 'login'" data-auth-view="login">
          <form id="authLoginForm" autocomplete="off" @submit.prevent="submit">
            <div class="auth-field">
              <label for="authUsername">账号名称</label>
              <input
                id="authUsername"
                v-model="username"
                type="text"
                class="field-control"
                name="username"
                autocomplete="username"
                maxlength="32"
                required
              />
            </div>
            <div class="auth-field">
              <label for="authPassword">密码</label>
              <input
                id="authPassword"
                v-model="password"
                type="password"
                class="field-control"
                name="password"
                autocomplete="current-password"
                maxlength="64"
                required
              />
            </div>
            <div class="auth-error" id="authLoginError" role="alert">{{ err }}</div>
            <div class="auth-actions">
              <button type="submit" class="btn btn-primary" id="authLoginBtn" :disabled="loading">
                {{ loading ? '登录中…' : '登录' }}
              </button>
            </div>
          </form>
          <p class="auth-hint">
            没有账号？
            <button type="button" class="auth-link-btn" @click="tab = 'contact'">联系管理员</button>
          </p>
        </div>

        <div v-show="tab === 'contact'" data-auth-view="contact">
          <div class="auth-contact">
            <p class="auth-qr-tip">请联系管理员开通账号或续费</p>
            <div class="auth-social">
              <a
                class="auth-social-link"
                href="https://www.xiaohongshu.com/"
                target="_blank"
                rel="noopener noreferrer"
                title="小红书"
                aria-label="小红书"
              >
                <iconify-icon icon="simple-icons:xiaohongshu" width="28" height="28" style="color:#ff2442"></iconify-icon>
              </a>
              <a
                class="auth-social-link"
                href="https://github.com/Jon-mubai/CMG-tool"
                target="_blank"
                rel="noopener noreferrer"
                title="GitHub"
                aria-label="GitHub"
              >
                <iconify-icon icon="ant-design:github-filled" width="28" height="28"></iconify-icon>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
