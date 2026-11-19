/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/features/scan-data.js */
/* ===== 盘点数据页 =====
     两段式：
       1) 盘点前账面库存 —— 来自每次 Excel 导入时写入的 original snapshot
       2) 已保存盘点报告 —— 用户在盘点明细页点击「保存为盘点报告」后生成的快照列表
  */
  /* 首次导入的原始账面快照（用于对比），写入 localStorage */
  var ORIG_KEY = 'inventory_check_original_v1';
  function saveOriginalSnapshot(list) {
    try { localStorage.setItem(ORIG_KEY, JSON.stringify(list)); } catch (err) {}
  }
  function loadOriginalSnapshot() {
    try {
      var raw = localStorage.getItem(ORIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }
  function clearOriginalSnapshot() {
    try { localStorage.removeItem(ORIG_KEY); } catch (err) {}
  }
