import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '../stores/user';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/login/LoginView.vue'), meta: { public: true } },
    {
      path: '/',
      component: () => import('../layouts/MainLayout.vue'),
      children: [
        { path: '', name: 'home', component: () => import('../views/HomeView.vue') },
        { path: 'admin/users', name: 'admin-users', component: () => import('../views/admin/UsersView.vue'), meta: { requiresAdmin: true } },
        { path: 'machine/profit', name: 'machine-profit', component: () => import('../views/machine/ProfitView.vue') },
        { path: 'inventory/docs', name: 'inventory-docs', component: () => import('../views/inventory/DocsView.vue') },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const store = useUserStore();
  if (to.meta.public) return true;
  if (!store.isLoggedIn) return { name: 'login' };
  if (!store.profile) {
    try { await store.fetchMe(); } catch { store.logout(); return { name: 'login' }; }
  }
  if (to.meta.requiresAdmin && !store.isAdmin) return { name: 'home' };
  return true;
});

export default router;
