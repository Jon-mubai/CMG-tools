import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as authApi from '../api/auth';

export const useUserStore = defineStore('user', () => {
  const accessToken = ref(localStorage.getItem('accessToken'));
  const profile = ref<any>(null);
  const isLoggedIn = computed(() => !!accessToken.value);
  const isAdmin = computed(() => profile.value?.role === 'admin');

  async function login(username: string, password: string) {
    const data = await authApi.login(username, password);
    accessToken.value = data.accessToken;
    localStorage.setItem('accessToken', data.accessToken);
    if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
    profile.value = data.user;
    return data;
  }
  function logout() {
    accessToken.value = null;
    profile.value = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
  async function fetchMe() {
    profile.value = await authApi.fetchMe();
    return profile.value;
  }
  function hasFeature(k: string) {
    if (!profile.value) return false;
    if (profile.value.role === 'admin') return true;
    const f = profile.value.features || [];
    return f.includes('*') || f.includes(k);
  }
  return { accessToken, profile, isLoggedIn, isAdmin, login, logout, fetchMe, hasFeature };
});
