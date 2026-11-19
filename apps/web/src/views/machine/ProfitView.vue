<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as api from '../../api/machine';
const rows = ref<any[]>([]);
const from = ref('');
const to = ref('');
const err = ref('');
async function load() {
  try { rows.value = await api.listWeekly(from.value || undefined, to.value || undefined); }
  catch (e: any) { err.value = e.response?.data?.message || '加载失败'; }
}
async function seed() {
  const today = new Date();
  const start = new Date(today); start.setDate(start.getDate() - 7);
  await api.createImport({
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: today.toISOString().slice(0, 10),
    rows: [
      { machineCode: 'M001', machineName: '演示A', coinRevenue: 1000, giftCost: 300 },
      { machineCode: 'M002', machineName: '演示B', coinRevenue: 800, giftCost: 250 },
    ],
  });
  await load();
}
onMounted(load);
</script>
<template>
  <div>
    <h1>机台毛利</h1>
    <div class="bar">
      <input v-model="from" type="date" />
      <input v-model="to" type="date" />
      <button @click="load">查询</button>
      <button class="btn" @click="seed">写入演示数据</button>
    </div>
    <p v-if="err" class="err">{{ err }}</p>
    <table>
      <thead><tr><th>账期</th><th>编码</th><th>名称</th><th>营收</th><th>成本</th><th>毛利</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id">
          <td>{{ String(r.periodStart).slice(0,10) }}~{{ String(r.periodEnd).slice(0,10) }}</td>
          <td>{{ r.machineCode }}</td><td>{{ r.machineName }}</td>
          <td>{{ r.coinRevenue }}</td><td>{{ r.giftCost }}</td><td>{{ r.grossProfit }}</td>
        </tr>
        <tr v-if="!rows.length"><td colspan="6">暂无数据</td></tr>
      </tbody>
    </table>
  </div>
</template>
<style scoped>
.bar{display:flex;gap:8px;margin:12px 0;flex-wrap:wrap}
table{width:100%;border-collapse:collapse;background:#fff;font-size:13px}
th,td{padding:10px;border-bottom:1px solid #f0f0f0}
.btn{background:#0a0a0a;color:#fff;border:0;border-radius:8px;padding:6px 12px;cursor:pointer}
.err{color:#dc2626}
</style>
