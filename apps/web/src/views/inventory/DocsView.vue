<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as api from '../../api/inventory';
const items = ref<any[]>([]);
const err = ref('');
async function load() {
  try {
    const r = await api.listDocs();
    items.value = r.items || [];
  } catch (e: any) { err.value = e.response?.data?.message || '加载失败'; }
}
async function create() {
  await api.createDoc({
    docNo: 'DOC-' + Date.now(),
    supplier: '演示供应商',
    lines: [{ skuCode: 'SKU1', skuName: '示例商品', qty: 1, amount: 10 }],
  });
  await load();
}
async function remove(id: string) {
  if (!confirm('删除？')) return;
  await api.deleteDoc(id); await load();
}
onMounted(load);
</script>
<template>
  <div>
    <div class="hd"><h1>库存单据</h1><button class="btn" @click="create">新建演示单据</button></div>
    <p v-if="err" class="err">{{ err }}</p>
    <table>
      <thead><tr><th>单号</th><th>供应商</th><th>行数</th><th>时间</th><th></th></tr></thead>
      <tbody>
        <tr v-for="d in items" :key="d.id">
          <td>{{ d.docNo }}</td><td>{{ d.supplier }}</td><td>{{ d.lineCount }}</td>
          <td>{{ String(d.createdAt).slice(0,19) }}</td>
          <td><button class="link" @click="remove(d.id)">删除</button></td>
        </tr>
        <tr v-if="!items.length"><td colspan="5">暂无单据</td></tr>
      </tbody>
    </table>
  </div>
</template>
<style scoped>
.hd{display:flex;justify-content:space-between;align-items:center}
table{width:100%;border-collapse:collapse;background:#fff;font-size:13px}
th,td{padding:10px;border-bottom:1px solid #f0f0f0}
.btn{background:#0a0a0a;color:#fff;border:0;border-radius:999px;padding:8px 14px;cursor:pointer}
.link{border:0;background:none;color:#dc2626;cursor:pointer}
.err{color:#dc2626}
</style>
