<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue';
import * as api from '../../api/admin-users';
const list = ref<any[]>([]);
const err = ref('');
const open = ref(false);
const form = reactive({ username: '', password: '', role: 'user', paid: false, plan: 'month', validUntil: '' });

async function load() {
  try { list.value = await api.listUsers(); } catch (e: any) { err.value = e.response?.data?.message || '加载失败'; }
}
function openCreate() {
  form.username = ''; form.password = ''; form.role = 'user'; form.paid = false; form.plan = 'month'; form.validUntil = '';
  open.value = true;
}
async function save() {
  try {
    await api.createUser({
      username: form.username, password: form.password, role: form.role,
      paid: form.paid, plan: form.plan, validUntil: form.validUntil || undefined,
    });
    open.value = false; await load();
  } catch (e: any) { err.value = e.response?.data?.message || '保存失败'; }
}
async function onDisable(u: any) {
  if (!confirm('禁用 ' + u.username + '？')) return;
  await api.disableUser(u.id); await load();
}
async function onReset(u: any) {
  const r = await api.resetPassword(u.id);
  alert(r.temporaryPassword ? '临时密码: ' + r.temporaryPassword : '已重置');
}
onMounted(load);
</script>
<template>
  <div>
    <div class="hd"><h1>账号与权限</h1><button class="btn" @click="openCreate">新建</button></div>
    <p v-if="err" class="err">{{ err }}</p>
    <table>
      <thead><tr><th>用户</th><th>角色</th><th>启用</th><th>付费</th><th>期限</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-for="u in list" :key="u.id">
          <td>{{ u.username }}</td>
          <td>{{ u.role }}</td>
          <td>{{ u.enabled ? '是' : '否' }}</td>
          <td>{{ u.role === 'admin' ? '—' : (u.paid ? '已开通' : '未开通') }}</td>
          <td>{{ u.validUntil ? String(u.validUntil).slice(0,10) : '—' }}</td>
          <td>
            <button class="link" @click="onReset(u)">重置密码</button>
            <button v-if="u.enabled" class="link" @click="onDisable(u)">禁用</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="open" class="mask" @click.self="open=false">
      <div class="drawer">
        <h2>新建用户</h2>
        <label>用户名<input v-model="form.username" /></label>
        <label>密码<input v-model="form.password" type="password" /></label>
        <label>角色<select v-model="form.role"><option value="user">user</option><option value="admin">admin</option></select></label>
        <label><input v-model="form.paid" type="checkbox" /> 已付费</label>
        <label>套餐<select v-model="form.plan"><option>week</option><option>month</option><option>quarter</option><option>year</option></select></label>
        <label>到期日<input v-model="form.validUntil" type="date" /></label>
        <div class="ft"><button @click="open=false">取消</button><button class="btn" @click="save">保存</button></div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.hd{display:flex;justify-content:space-between;align-items:center}
table{width:100%;border-collapse:collapse;background:#fff;font-size:13px}
th,td{padding:10px;border-bottom:1px solid #f0f0f0;text-align:left}
.btn{background:#0a0a0a;color:#fff;border:0;border-radius:999px;padding:8px 14px;cursor:pointer}
.link{border:0;background:none;color:#2563eb;cursor:pointer;margin-right:8px}
.mask{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;justify-content:flex-end}
.drawer{width:360px;background:#fff;padding:20px;display:flex;flex-direction:column;gap:10px}
label{display:flex;flex-direction:column;gap:4px;font-size:12px}
input,select{height:34px;border:1px solid #e5e5e5;border-radius:8px;padding:0 8px}
.ft{display:flex;gap:8px;justify-content:flex-end}
.err{color:#dc2626}
</style>
