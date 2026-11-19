/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/warehouse/wh-module.js — 仓库管理：3D 园区 + 库存管理 */
/* ==========================================================================
   仓库管理模块：3D 园区可视化 + 库存管理
   - 数据层：多仓库 / 货架 / 品类 / 出入库流水 / 预警配置（本地生成，可接入真实接口）
   - 可视化：CSS 3D 等轴测园区，轨道旋转 + 缩放 + 平移，点击货架出详情面板
   ========================================================================== */
var WH = (function () {
  'use strict';

  /* ---------- 数据层：仓库 / 货架 / 品类 ---------- */
  /* 仓库与布局均可自定义：DEFAULT_WH 是出厂模板，用户改动存 WH_CFG_KEY */
  var WH_CFG_KEY = 'inventory_check_warehouse_cfg_v8';
  /* 出厂模板：对齐平面图 WH-PL-001 毛绒 / WH-PL-002 良品 / WH-PL-003 中转（1:50）
     房间约 7.2 × 5.0~5.1 m（240 砖墙）。坐标：房间中心为原点，北=-z、西=-x，单位米。 */
  var DEFAULT_WH = [
    /* ========== WH-PL-002 良品仓库 7200×5000 ==========
       北：N-1 N-2 · 南：S-1 S-2 · 西竖列：W-1~W-4 · 中：M-1(五层1.5m) · 旁小货架
       东侧主通道/操作区≈2.4m · 入口 M1 东墙 */
    { id: 'WH-A', code: 'LP-01', name: '良品仓库', area: '约 36 m²', city: '7.2 × 5.0 m', accent: '#4a7cae',
      zones: [
        { key: 'north', name: '北侧靠墙货架组', isGift: false, cols: 2, rows: 1, levels: 4, codes: ['N-1', 'N-2'], pos: [-1.20, -2.10], gapX: 1.50, rw: 1.10, rd: 0.45, accent: '#4a7cae' },
        { key: 'west', name: '西端靠墙竖向列', isGift: false, cols: 1, rows: 4, levels: 4, codes: ['W-1', 'W-2', 'W-3', 'W-4'], pos: [-3.15, 0.0], orientation: 'v', gapZ: 1.15, rw: 1.00, rd: 0.45, accent: '#4a7cae' },
        { key: 'mid', name: '中间五层货架', isGift: false, cols: 1, rows: 1, levels: 5, codes: ['M-1'], pos: [-1.20, 0.0], rw: 1.50, rd: 0.55, accent: '#4a7cae' },
        { key: 'small', name: '小货架', isGift: false, cols: 1, rows: 1, levels: 3, codes: ['M-2'], pos: [-0.15, 0.0], orientation: 'v', rw: 0.55, rd: 0.30, accent: '#4a7cae' },
        { key: 'south', name: '南侧靠墙货架组', isGift: false, cols: 2, rows: 1, levels: 4, codes: ['S-1', 'S-2'], pos: [-1.20, 2.10], gapX: 1.50, rw: 1.10, rd: 0.45, accent: '#4a7cae' },
        { key: 'aisleN', kind: 'aisle', name: '北侧通道', dir: 'ew', note: '净宽≈900', noRack: true, pos: [-1.20, -1.35], pw: 3.2, pd: 0.9, accent: '#9aa3ad' },
        { key: 'aisleS', kind: 'aisle', name: '南侧通道', dir: 'ew', note: '净宽≈900', noRack: true, pos: [-1.20, 1.35], pw: 3.2, pd: 0.9, accent: '#9aa3ad' },
        { key: 'mainAisle', kind: 'aisle', name: '主通道/操作区', dir: 'ns', note: '东侧净宽≈2400', noRack: true, pos: [2.20, 0.0], pw: 2.40, pd: 4.80, accent: '#8a94a0' },
        { key: 'doorM1', kind: 'door', name: '入口 M1', noRack: true, note: '900×2100 内开', pos: [3.45, 0.30], pw: 0.28, pd: 0.90, accent: '#2e7d4f' }
      ] },
    /* ========== WH-PL-001 毛绒仓库 7200×5000 ==========
       北：4-1 4-2 · 中：2-1 2-2 · 南：1-1 1-2 · 西：3-1 3-2 3-3 · 东北杂物区 */
    { id: 'WH-B', code: 'MC-02', name: '毛绒仓库', area: '约 36 m²', city: '7.2 × 5.0 m', accent: '#7a5cb8',
      zones: [
        { key: 'row4', name: '北侧靠墙货架组', isGift: false, cols: 2, rows: 1, levels: 4, codes: ['4-1', '4-2'], pos: [-1.30, -2.10], gapX: 1.40, rw: 1.10, rd: 0.45, accent: '#7a5cb8' },
        { key: 'col3', name: '西端单排货架列', isGift: false, cols: 1, rows: 3, levels: 4, codes: ['3-1', '3-2', '3-3'], pos: [-3.15, -0.15], orientation: 'v', gapZ: 1.35, rw: 1.00, rd: 0.45, accent: '#7a5cb8' },
        { key: 'row2', name: '中间列货架组', isGift: false, cols: 2, rows: 1, levels: 4, codes: ['2-1', '2-2'], pos: [-1.30, -0.35], gapX: 1.30, rw: 1.10, rd: 0.45, accent: '#7a5cb8' },
        { key: 'row1', name: '南侧靠墙货架组', isGift: false, cols: 2, rows: 1, levels: 4, codes: ['1-1', '1-2'], pos: [-1.30, 2.10], gapX: 1.30, rw: 1.10, rd: 0.45, accent: '#7a5cb8' },
        { key: 'misc', name: '杂物区', isGift: false, cols: 1, rows: 1, levels: 1, noRack: true, pos: [2.55, -1.65], pw: 1.70, pd: 1.50, accent: '#b04a4a' },
        { key: 'colAisle', kind: 'aisle', name: '列间通道', dir: 'ew', note: '净宽≈600', noRack: true, pos: [-1.30, -1.20], pw: 3.0, pd: 0.60, accent: '#9aa3ad' },
        { key: 'mainAisle', kind: 'aisle', name: '内部主通道', dir: 'ew', note: '净宽≈1200', noRack: true, pos: [-1.30, 0.90], pw: 3.0, pd: 1.20, accent: '#8a94a0' },
        { key: 'opAisle', kind: 'aisle', name: '东侧操作区', dir: 'ns', note: '净宽≈2400', noRack: true, pos: [2.20, 0.40], pw: 2.40, pd: 3.20, accent: '#8a94a0' },
        { key: 'doorM1', kind: 'door', name: '入口 M1', noRack: true, note: '900×2100 内开', pos: [3.45, 0.20], pw: 0.28, pd: 0.90, accent: '#2e7d4f' }
      ] },
    /* ========== WH-PL-003 中转仓 7200×5100 ==========
       中部横排：S-1 | 承重墙 | S-2 | S-3 · 西南 W-1 竖向 · 东北临时存放 · 南侧主通道东西向 */
    { id: 'WH-C', code: 'ZZ-03', name: '中转仓库', area: '约 37 m²', city: '7.2 × 5.1 m', accent: '#3fb984',
      zones: [
        { key: 'west', name: '西南角靠墙', isGift: false, cols: 1, rows: 1, levels: 4, codes: ['W-1'], pos: [-3.15, 1.40], orientation: 'v', rw: 1.00, rd: 0.45, accent: '#3fb984' },
        { key: 's1', name: '货架 S-1', isGift: false, cols: 1, rows: 1, levels: 4, codes: ['S-1'], pos: [-1.70, -0.55], rw: 1.20, rd: 0.50, accent: '#3fb984' },
        { key: 'wallE', kind: 'wall', name: '承重墙', noRack: true, note: '240厚竖向', pos: [-0.70, -0.55], pw: 0.24, pd: 1.40, accent: '#555b60' },
        { key: 's2', name: '货架 S-2', isGift: false, cols: 1, rows: 1, levels: 4, codes: ['S-2'], pos: [0.40, -0.55], rw: 1.20, rd: 0.50, accent: '#3fb984' },
        { key: 's3', name: '货架 S-3', isGift: false, cols: 1, rows: 1, levels: 4, codes: ['S-3'], pos: [1.85, -0.55], rw: 1.20, rd: 0.50, accent: '#3fb984' },
        { key: 'temp', name: '临时存放点', isGift: false, cols: 1, rows: 1, levels: 1, noRack: true, pos: [2.25, -1.80], pw: 2.20, pd: 1.30, accent: '#d6a12f' },
        { key: 'mainAisle', kind: 'aisle', name: '主通道', dir: 'ew', note: '南侧靠墙 · 东西走向', noRack: true, pos: [0.40, 1.60], pw: 5.80, pd: 1.55, accent: '#8a94a0' },
        { key: 'doorM1', kind: 'door', name: '入口 M1', noRack: true, note: '900×2100 内开', pos: [3.45, -0.40], pw: 0.28, pd: 0.90, accent: '#2e7d4f' }
      ] }
  ];
  var ZONE_PRESETS = [
    { key: 'gift', name: '礼品区', isGift: true },
    { key: 'cargo', name: '货物区', isGift: false },
    { key: 'buffer', name: '暂存区', isGift: false }
  ];

  /* 读取用户配置（名称、编号、面积、城市、分区排布、货架层数） */
  function loadWhCfg() {
    try {
      var raw = localStorage.getItem(WH_CFG_KEY);
      var arr = raw ? JSON.parse(raw) : null;
      if (!Array.isArray(arr) || !arr.length) return JSON.parse(JSON.stringify(DEFAULT_WH));
      return arr.map(function (w, i) {
        var d = DEFAULT_WH[i] || DEFAULT_WH[0];
        var zones = Array.isArray(w.zones) && w.zones.length ? w.zones : d.zones;
        return {
          id: w.id || ('WH-' + i),
          code: (w.code || d.code).slice(0, 12),
          name: (w.name || d.name).slice(0, 20),
          area: (w.area || d.area).slice(0, 20),
          city: (w.city || d.city).slice(0, 30),
          /* 3D 主题色：仓库可自定义，未配置时沿用出厂模板 / 默认蓝 */
          accent: (w.accent || d.accent || '#4a7cae').slice(0, 9),
          zones: zones.map(function (z) {
            var p = ZONE_PRESETS.filter(function (x) { return x.key === z.key; })[0] || ZONE_PRESETS[1];
            var out = {
              key: z.key, name: (z.name || p.name).slice(0, 10), isGift: !!z.isGift,
              cols: Math.max(1, Math.min(6, parseInt(z.cols, 10) || 2)),
              rows: Math.max(1, Math.min(4, parseInt(z.rows, 10) || 1)),
              levels: Math.max(1, Math.min(6, parseInt(z.levels, 10) || 4))
            };
            /* 平面图扩展字段（显式货架编号 / 显式落位 / 无货架功能区）必须原样保留，
               否则保存一次仓库设置后 3D 就退回自动排布、货架名变回自动编号 */
            if (z.accent) out.accent = String(z.accent).slice(0, 9);
            if (Array.isArray(z.codes) && z.codes.length) {
              out.codes = z.codes.map(function (c) { return String(c).slice(0, 12); });
            }
            if (Array.isArray(z.pos) && z.pos.length >= 2 &&
                isFinite(parseFloat(z.pos[0])) && isFinite(parseFloat(z.pos[1]))) {
              out.pos = [parseFloat(z.pos[0]), parseFloat(z.pos[1])];
            }
            if (z.noRack) out.noRack = true;
            if (z.orientation === 'v') out.orientation = 'v';
            /* 建筑构件分区（入口门 / 主通道 / 隔墙）：类型、走向、说明文字必须保留，
               否则保存一次设置后 3D 里的门与通道就消失 */
            if (z.kind) out.kind = String(z.kind).slice(0, 10);
            if (z.dir) out.dir = String(z.dir).slice(0, 4);
            if (z.note) out.note = String(z.note).slice(0, 24);
            /* 平面图实测参数：分区级货架间距 / 货架尺寸 / 功能区地台尺寸，
               与 pos 同理必须原样保留，否则保存设置后间距退回统一网格 */
            ['gapX', 'gapZ', 'rw', 'rd', 'pw', 'pd'].forEach(function (k) {
              var v = parseFloat(z[k]);
              if (isFinite(v) && v > 0) out[k] = Math.min(6, Math.max(0.15, v));
            });
            return out;
          })
        };
      });
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_WH)); }
  }
  function saveWhCfg(list) {
    try { localStorage.setItem(WH_CFG_KEY, JSON.stringify(list)); } catch (e) {}
  }

  /* ---------- 货架自定义（编号 / 名称 / 层名称） ----------
     存储结构：{ [whId]: { [rackId]: { code, name, levels: { [levelNo]: name } } } }
     applyRackCustom 在 rebuildLayouts 之后调用，把自定义覆盖到 rack.code/rack.name/level.name
     —— 货架与货架层都可重命名，改名后 3D 标签与详情面板同步生效。 */
  var RACK_CFG_KEY = 'inventory_check_rack_cfg_v1';
  function loadRackCfg() {
    try {
      var raw = localStorage.getItem(RACK_CFG_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveRackCfg(cfg) {
    try { localStorage.setItem(RACK_CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }
  /* 把自定义编号 / 名称 / 层名称合并进 LAYOUTS 内的对象（原地修改） */
  function applyRackCustom() {
    var cfg = loadRackCfg();
    WAREHOUSES.forEach(function (wh) {
      var layout = LAYOUTS[wh.id];
      if (!layout) return;
      var whCfg = cfg[wh.id] || {};
      layout.racks.forEach(function (rack) {
        var c = whCfg[rack.id];
        if (c && c.code) rack.code = String(c.code).slice(0, 12);
        rack.name = (c && c.name) ? String(c.name).slice(0, 20) : '';
        var lvMap = (c && c.levels) || {};
        rack.levels.forEach(function (lv) {
          lv.name = lvMap[lv.level] ? String(lvMap[lv.level]).slice(0, 16) : '';
        });
      });
    });
  }

  var WAREHOUSES = loadWhCfg();

  /* 品类定义：isGift 决定园区内金色礼品区 / 灰色货物区 */
  var CATEGORIES = [
    { key: 'gift-box',  name: '礼品盒装', isGift: true  },
    { key: 'gift-bag',  name: '礼袋系列', isGift: true  },
    { key: 'drink',     name: '饮料酒水', isGift: false },
    { key: 'daily',     name: '日用百货', isGift: false },
    { key: 'snack',     name: '休闲零食', isGift: false },
    { key: 'season',    name: '节庆礼品', isGift: true  }
  ];

  /* 货品主数据不再内置示例：真实货品一律来自「数据导入」。
     导入的每个 SKU 会成为一条货品记录（含名称与结存数量），
     供 3D 园区陈列、库存预警、滞销分析共用，避免系统自带假数据干扰。
     buildImportGoodsPool() 负责从 STOCK_IMPORT 构建。 */

  var STAFF = ['张启明', '李慧敏', '王振华', '陈思远', '刘晓芸', '赵国强', '孙佳怡', '周文博'];
  var CARRIERS = ['顺丰速运', '京东物流', '德邦快递', '中通快运'];

  /* 伪随机（固定种子 → 每次打开数据一致，便于核对） */
  function seeded(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  /* 仓库布局：按用户配置生成分区 / 货架阵列 / 每架层数（种子固定，数据稳定可核对） */
  var LAYOUTS = {};
  /* 从导入数据构建货品池：合并 history + current 的 bySku，
     库存量优先取「变更后数量」（结存），无该字段时回退累计出库量。
     没有导入数据时返回空数组 —— 系统不自带示例商品。 */
  function buildImportGoodsPool() {
    var merged = {};
    ['history', 'current'].forEach(function (mode) {
      var im = STOCK_IMPORT[mode];
      if (!im || !im.bySku) return;
      Object.keys(im.bySku).forEach(function (sku) {
        var d = im.bySku[sku];
        if (!merged[sku]) {
          merged[sku] = {
            sku: sku, name: d.name || sku,
            cat: guessCatFromName(d.name || ''),
            price: d.price || 0, qty: 0, whs: {}
          };
        }
        /* 结存数量优先（反映当前真实库存），否则用出库累计 */
        var stock = (typeof d.qtyAfter === 'number' && d.qtyAfter > 0) ? d.qtyAfter : (d.outQty || 0);
        merged[sku].qty = Math.max(merged[sku].qty, stock);
        if (!merged[sku].name && d.name) merged[sku].name = d.name;
        /* 累计 SKU 在各来源仓库的出现次数，供「主仓库」归属判定 */
        if (d.whs) {
          Object.keys(d.whs).forEach(function (w) {
            if (w) merged[sku].whs[w] = (merged[sku].whs[w] || 0) + d.whs[w];
          });
        }
      });
    });
    return Object.keys(merged).map(function (k) {
      var g = merged[k];
      /* 主仓库：出现次数最多的来源仓库（无仓库信息则为空串） */
      var best = '', bestN = 0;
      Object.keys(g.whs).forEach(function (w) {
        if (g.whs[w] > bestN) { best = w; bestN = g.whs[w]; }
      });
      g.wh = best;
      return g;
    });
  }
  /* 按商品名关键词粗分品类：导入数据只给中文分类名，此处映射到内部 key */
  function guessCatFromName(name) {
    var s = String(name || '');
    if (/酒|茶|饮|咖|水|奶|液/.test(s)) return 'drink';
    if (/袋|包|纸|巾|卡|券/.test(s)) return 'daily';
    if (/玩|具|积木|模型|车/.test(s)) return 'toy';
    if (/美妆|护肤|面膜|洗|香/.test(s)) return 'beauty';
    if (/粮|食|饮|果|巧|糖|茶/.test(s)) return 'food';
    return 'gift-box';
  }

  /* ---------- 3D 园区网格常量（仓库设置里的「列数/行数/层数」直接决定这些值） ----------
     R3F 与原生 CSS 3D 两套渲染共用同一份推导，保证同一配置在两种渲染下布局一致。 */
  /* 比例尺：1 世界单位 = 1 米。房间 7.2 × 5.1 m。
     colGap / rowGap = 相邻货架中心距（米），aisle = 分区之间通道宽度（米）。
     RACK_SIZE = 货架物理尺寸（米），必须与 embed 侧 RACK_W / RACK_D 保持一致。 */
  var PARK_GRID = { colGap: 2.0, rowGap: 1.5, aisle: 1.0 };
  var RACK_SIZE = { w: 1.2, d: 0.6 };
  /* 当前舞台画布宽高比：决定分区该横排还是竖排，避免园区细长导致大片留白 */
  function parkAspect() {
    var st = document.getElementById('parkStage');
    if (!st) return 1.4;
    var r = st.getBoundingClientRect();
    return r.height > 0 ? (r.width / r.height) : 1.4;
  }
  /* 依据分区配置推导 3D 世界坐标（原地写入 zone.originX/originZ/spanX/spanZ）。
     修复前的 bug：所有分区共用同一套 (col,row) 网格坐标，只对 gift/buffer 做了
     硬编码偏移（-0.8 / +5.2），cargo 与用户新增的分区完全没有偏移 ——
     于是多个分区的货架叠在同一片区域，仓库设置里改行列，3D 显示对不上。

     本轮进一步修复「园区细长 / 可视范围过小」：
     旧实现把所有分区单向沿 Z 排开，3 分区时园区约 21×62（宽高比 0.34），
     而画布约 1.4 —— 横向必然浪费近七成视野，看起来就是「只有一小块」。
     现在按画布宽高比自动选最优排布：
       · 1~2 个分区 → 单列/单行（本就紧凑，无需拆）
       · 3 个分区 → 优先 1 行 × 3 列（横向铺开，贴近宽画布）
       · 4 个 → 2×2；5~6 个 → 2 行（3+3 / 3+2+1 均衡切分）
     并保证行列块内按块宽高居中，最后整体平移使园区几何中心落在原点。 */
  function layoutZones3D(zones) {
    zones = zones || [];
    if (!zones.length) return { width: 0, depth: 0 };
    /* 每个分区的自身占位（米）：按货架物理尺寸（分区级 rw/rd 可覆盖）+ 朝向 +
       分区级间距（gapX/gapZ 可覆盖）算外接矩形；无货架功能区用地台尺寸（pw/pd 可覆盖）。 */
    var sizes = zones.map(function (z) {
      if (z.noRack) return { w: z.pw || 1.6, d: z.pd || 1.2 };
      var n = Math.max(z.cols || 1, 1), m = Math.max(z.rows || 1, 1);
      var rw = z.rw || RACK_SIZE.w, rd = z.rd || RACK_SIZE.d;
      var gx = z.gapX || PARK_GRID.colGap, gz = z.gapZ || PARK_GRID.rowGap;
      var vert = z.orientation === 'v';
      if (vert) {
        return { w: rd, d: m * rw + (m - 1) * (gz - rw) };
      }
      return { w: n * rw + (n - 1) * (gx - rw),
               d: m * rd + (m - 1) * (gz - rd) };
    });
    var n = zones.length;

    /* 显式落位：全部分区都带 pos（平面图模式）时按「米坐标」直接摆放，
       pos = 分区中心的房间内坐标（以房间中心为原点），随后整体居中。
       只要有一个分区缺 pos（例如用户新增）就走下方自动排布兜底。 */
    var allPos = zones.every(function (z) { return Array.isArray(z.pos) && z.pos.length >= 2; });
    if (allPos) {
      var minXp = Infinity, maxXp = -Infinity, minZp = Infinity, maxZp = -Infinity;
      zones.forEach(function (z, i) {
        z.originX = z.pos[0];
        z.originZ = z.pos[1];
        z.spanX = sizes[i].w;
        z.spanZ = sizes[i].d;
        minXp = Math.min(minXp, z.originX - z.spanX / 2);
        maxXp = Math.max(maxXp, z.originX + z.spanX / 2);
        minZp = Math.min(minZp, z.originZ - z.spanZ / 2);
        maxZp = Math.max(maxZp, z.originZ + z.spanZ / 2);
      });
      /* pos 已是房间绝对坐标（以房间中心为原点、北 = -z），不能再重定心——
         平面图布局天然不对称（西侧列贴墙、东侧留主通道），
         按内容包围盒居中会把整组货架平移、破坏与平面图的对位。 */
      return { width: maxXp - minXp, depth: maxZp - minZp, blockCols: 0, blockRows: 0, explicit: true };
    }

    /* 决定分区块网格：cols 为每行放几个分区 */
    var blockCols;
    if (n <= 2) blockCols = n;                    /* 1~2 个：单行 */
    else if (n === 3) blockCols = 3;              /* 3 个：单行铺开最贴宽画布 */
    else if (n === 4) blockCols = 2;              /* 2×2 */
    else blockCols = 3;                           /* 5~6 个：每行 3 个，均衡 2 行 */
    var blockRows = Math.ceil(n / blockCols);

    /* 单行时若园区仍明显比画布"高瘦"，就转成竖排（2 个分区尤其明显） */
    if (blockRows === 1 && n > 1) {
      var w1 = 0, d1 = 0;
      sizes.forEach(function (s) { w1 += s.w + PARK_GRID.aisle; d1 = Math.max(d1, s.d); });
      w1 -= PARK_GRID.aisle;
      /* 目标比例：让园区宽高比靠近画布（不要求完全一致，取更接近的一侧） */
      var cur = w1 / Math.max(d1, 0.001);
      if (cur < parkAspect() * 0.62) { blockCols = 1; blockRows = n; }
    }

    /* 逐行分配：尽量让每行总宽接近，避免最后一行孤零零 */
    var rowW = [], rowD = [], rowCount = [];
    var idx = 0;
    for (var br = 0; br < blockRows; br++) {
      /* 均衡切分：前面的行多放一个 */
      var perRow = Math.floor(n / blockRows) + (br < (n % blockRows) ? 1 : 0);
      var wsum = 0, dmax = 0;
      for (var k = 0; k < perRow && idx < n; k++, idx++) {
        wsum += sizes[idx].w + PARK_GRID.aisle;
        dmax = Math.max(dmax, sizes[idx].d);
      }
      rowW.push(wsum - PARK_GRID.aisle);
      rowD.push(dmax);
      rowCount.push(perRow);
    }
    var totalW = Math.max.apply(null, rowW);
    var totalD = 0;
    rowD.forEach(function (d, i) { totalD += d + (i < rowD.length - 1 ? PARK_GRID.aisle : 0); });

    /* 落位：块内居中、块间留通道 */
    var cursorZ = 0, i2 = 0;
    for (var br2 = 0; br2 < blockRows; br2++) {
      var cx = -(totalW / 2);                 /* 本行起点（行内整体居中） */
      for (var k2 = 0; k2 < rowCount[br2] && i2 < n; k2++, i2++) {
        var z = zones[i2], s = sizes[i2];
        z.originX = cx + (rowW[br2] - s.w) / 2;
        z.originZ = cursorZ + (rowD[br2] - s.d) / 2;
        z.spanX = s.w;
        z.spanZ = s.d;
        cx += s.w + PARK_GRID.aisle;
      }
      cursorZ += rowD[br2] + PARK_GRID.aisle;
    }
    return { width: totalW, depth: totalD, blockCols: blockCols, blockRows: blockRows };
  }

  function rebuildLayouts() {
    LAYOUTS = {};
    /* 货品池来自导入数据（真实数据以导入为准）。
       无导入时为空数组 —— 仓库/分区/货架结构仍保留（3D 园区与设置面板依赖），
       但不塞入任何伪随机商品，避免系统自带示例数据干扰真实分析。 */
    var importPool = buildImportGoodsPool();
    /* 按 SKU 主仓库把货品池分配到对应仓库：名称能与配置仓库匹配的放对应仓；
       匹配不上（导入未填仓库或名称不一致）按序轮询均分。
       每个 SKU 只进一个仓库 —— 此前每个仓都装全量商品，库存被仓库数放大。 */
    var whPools = {};
    WAREHOUSES.forEach(function (w) { whPools[w.id] = []; });
    var rr = 0;
    importPool.forEach(function (g) {
      var target = null;
      if (g.wh) {
        for (var i = 0; i < WAREHOUSES.length; i++) {
          var w = WAREHOUSES[i];
          if (w.name === g.wh || g.wh.indexOf(w.name) >= 0 || w.name.indexOf(g.wh) >= 0) { target = w.id; break; }
        }
      }
      if (!target) { target = WAREHOUSES[rr % WAREHOUSES.length].id; rr++; }
      whPools[target].push(g);
    });
    WAREHOUSES.forEach(function (wh, wi) {
      var zones = wh.zones || [];
      /* 先按配置推导分区占位与原点，货架坐标才能与设置里的行列一一对应 */
      var lzInfo = layoutZones3D(zones);
      var racks = [];
      var zIndex = 0;   /* 货架渲染层级（用于 CSS 3D 的 z 轴排序） */
      zones.forEach(function (z) {
        /* 特殊功能区（杂物区 / 临时存放点）：只画地台，不生成货架 */
        if (z.noRack) return;
        /* 分区级间距（平面图实测）：缺省回退统一网格 */
        var gx = z.gapX || PARK_GRID.colGap, gz = z.gapZ || PARK_GRID.rowGap;
        /* 分区级货架尺寸（如 M-1 的 1.5m 长货架、小货架 0.6×0.25） */
        var rwZ = z.rw || RACK_SIZE.w, rdZ = z.rd || RACK_SIZE.d;
        for (var c = 0; c < (z.cols || 1); c++) {
          for (var r = 0; r < (z.rows || 1); r++) {
            var levels = [];
            var levelCount = z.levels || 4;
            for (var lv = 1; lv <= levelCount; lv++) {
              /* 品类按分区属性确定，不再随机 */
              var cat = z.isGift ? 'gift-box' : 'daily';
              levels.push({
                level: lv, cat: cat, capacity: 60, stock: 0, name: '',
                goods: []   /* 始终为数组：无导入数据时为空，下游 reduce/forEach 不再需判 null */
              });
            }
            /* 显式编号（平面图模式）：zone.codes 按 cols×rows 生成序对应货架，
               未配置时回退「仓编-分区首字母-序号」的自动规则 */
            var gen = racks.length + 1;
            var code = (Array.isArray(z.codes) && z.codes[c * (z.rows || 1) + r])
              ? z.codes[c * (z.rows || 1) + r]
              : wh.code + '-' + z.key.charAt(0).toUpperCase() + String(gen).padStart(2, '0');
            racks.push({
              id: wh.code + '-R' + String(gen).padStart(2, '0'),
              code: code,
              zone: z.key, zoneName: z.name, isGift: z.isGift,
              col: c, row: r, zIndex: zIndex++,
              /* 货架朝向：'h' 横放（长边沿东西 x）、'v' 竖放（长边沿南北 z，西侧列） */
              orientation: z.orientation === 'v' ? 'v' : 'h',
              /* 分区级货架长/短边（米），embed 按此渲染，缺省 RACK_SIZE */
              rw: rwZ, rd: rdZ,
              /* 3D 世界坐标（米）：分区中心 + 相对行列偏移（关于分区中心对称），
                 与仓库设置的行列严格对应 */
              wx: z.originX + (c - ((z.cols || 1) - 1) / 2) * gx,
              wz: z.originZ + (r - ((z.rows || 1) - 1) / 2) * gz,
              levels: levels
            });
          }
        }
      });
    /* 把本仓货品池逐个货位轮询分配：每个 SKU 在一个仓内只出现一次，
       库存总量 = 导入结存总量，不再被货架数放大。
       礼品类 SKU 优先落礼品分区，其余落普通分区。 */
    var pool0 = whPools[wh.id] || [];
    if (pool0.length) {
      var giftSlots = [], normalSlots = [];
      racks.forEach(function (r) {
        r.levels.forEach(function (lv) {
          (r.isGift ? giftSlots : normalSlots).push(lv);
        });
      });
      var gi = 0, ni = 0;
      pool0.forEach(function (g) {
        var isGift = g.cat === 'gift-box';
        var slot = null;
        if (isGift && giftSlots.length) slot = giftSlots[gi++ % giftSlots.length];
        else if (!isGift && normalSlots.length) slot = normalSlots[ni++ % normalSlots.length];
        else if (normalSlots.length) slot = normalSlots[ni++ % normalSlots.length];
        else if (giftSlots.length) slot = giftSlots[gi++ % giftSlots.length];
        if (slot) slot.goods.push({ sku: g.sku, name: g.name, price: g.price, qty: g.qty || 0 });
      });
      racks.forEach(function (r) {
        r.levels.forEach(function (lv) {
          /* 库存量取自导入的结存数量（变更后数量） */
          lv.stock = lv.goods.reduce(function (s, g) { return s + (g.qty || 0); }, 0);
        });
      });
    }
    /* 显式平面图模式附带房间尺寸：embed 据此画 240 砖墙轮廓、并把取景范围
       扩到整间房（而不是只框货架内容），与平面图逐米对齐一目了然 */
    /* 房间尺寸：优先用仓库 city 字段解析，否则 7.2×5.0；始终传给 R3F 以对齐平面图 */
    var roomW = 7.2, roomD = 5.0;
    if (wh.city) {
      var m = String(wh.city).match(/([\d.]+)\s*[×xX]\s*([\d.]+)/);
      if (m) { roomW = parseFloat(m[1]) || 7.2; roomD = parseFloat(m[2]) || 5.0; }
    }
    LAYOUTS[wh.id] = { zones: zones, racks: racks,
      room: { w: roomW, d: roomD, wall: 0.24 } };
    });
    /* 容量标定（第二遍）：导入数据不含真实货位容量，
       取货位库存的 P90 为基准容量（避免个别超大数量 SKU——如游戏币/积分卡——
       把所有货位压成 0%）。占用率为相对值，展示时截断到 100%。 */
    var lvStocks = [];
    WAREHOUSES.forEach(function (wh) {
      LAYOUTS[wh.id].racks.forEach(function (r) {
        r.levels.forEach(function (lv) { if (lv.stock > 0) lvStocks.push(lv.stock); });
      });
    });
    lvStocks.sort(function (a, b) { return a - b; });
    var p90 = lvStocks.length ? lvStocks[Math.min(lvStocks.length - 1, Math.floor(lvStocks.length * 0.9))] : 0;
    var baseCap = Math.max(60, p90);
    WAREHOUSES.forEach(function (wh) {
      LAYOUTS[wh.id].racks.forEach(function (r) {
        r.levels.forEach(function (lv) { lv.capacity = baseCap; });
      });
    });
  }
  /* 布局构建依赖导入数据（buildImportGoodsPool 读 STOCK_IMPORT）。
     注意：STOCK_IMPORT_KEY / loadStockImport 在下方才声明（var 提升后此处为 undefined），
     若在此处调用 loadStockImport 会以 "undefined" 为 key 读到空数据 ——
     首次构建统一下移到 STOCK_IMPORT 初始化之后（见下方「首次构建」注释）。 */

  /* ---------- 出入库流水（近 7 天） ---------- */
  var FLOWS = [];
  /* 出入库流水：
     有导入数据时以导入的真实变更记录为准（history + current 合并去重）；
     未导入时才回退到布局派生的占位流水，保证三维园区与预警模块有骨架可用。 */
  function rebuildFlows() {
    FLOWS = [];
    /* ---- 优先：导入的真实明细 ---- */
    var seen = {};
    ['history', 'current'].forEach(function (mode) {
      var im = STOCK_IMPORT[mode];
      if (!im || !im.detail || !im.detail.length) return;
      im.detail.forEach(function (d) {
        var key = (mode === 'history' ? 'H' : 'C') + (d.orderNo || '') + '|' + d.sku + '|' + d.time;
        if (seen[key]) return;
        seen[key] = 1;
        FLOWS.push({
          id: 'IM' + String(FLOWS.length + 1).padStart(5, '0'),
          type: d.type,
          whId: '', whName: d.wh || '—',
          rackCode: d.cat || '—', level: 0,
          sku: d.sku, goods: d.goods, qty: d.qty,
          staff: d.by || '—',
          carrier: d.kind || (d.type === 'in' ? '入库' : '出库'),
          orderNo: d.orderNo || '',
          time: new Date(d.time || Date.now())
        });
      });
    });
    /* ---- 回退：布局派生的占位流水 ---- */
    if (!FLOWS.length) {
      WAREHOUSES.forEach(function (wh, wi) {
        var rnd = seeded(421 + wi * 89);
        var racks = LAYOUTS[wh.id].racks;
        if (!racks || !racks.length) return;
        for (var d = 59; d >= 0; d--) {
          var cnt = 2 + Math.floor(rnd() * 5);
          for (var i = 0; i < cnt; i++) {
            var isIn = rnd() > 0.46;
            var rack = racks[Math.floor(rnd() * racks.length)];
            var lvl = rack.levels[Math.floor(rnd() * rack.levels.length)];
            /* 无导入数据时货位为空（goods:[]），跳过占位流水生成，避免越界取 undefined */
            if (!lvl.goods || !lvl.goods.length) continue;
            var g = lvl.goods[Math.floor(rnd() * lvl.goods.length)];
            var qty = 1 + Math.floor(rnd() * 24);
            var dt = new Date();
            dt.setDate(dt.getDate() - d);
            dt.setHours(8 + Math.floor(rnd() * 10), Math.floor(rnd() * 60), 0, 0);
            FLOWS.push({
              id: 'FL' + String(FLOWS.length + 1).padStart(5, '0'),
              type: isIn ? 'in' : 'out',
              whId: wh.id, whName: wh.name,
              rackCode: rack.code, level: lvl.level,
              sku: g.sku, goods: g.name, qty: qty,
              staff: STAFF[Math.floor(rnd() * STAFF.length)],
              carrier: CARRIERS[Math.floor(rnd() * CARRIERS.length)],
              orderNo: '',
              time: dt
            });
          }
        }
      });
    }
    FLOWS.sort(function (a, b) { return b.time - a.time; });
    __ovCache = null; __ovKey = '';
  }
  /* 注意：此处不立即调用 —— STOCK_IMPORT 在下方才初始化，
     提前调用会读到 undefined。首次构建移到 STOCK_IMPORT 赋值之后。 */

  /* ---------- 预警配置（可调，存 localStorage） ---------- */
  var ALERT_CFG_KEY = 'inventory_check_alert_cfg_v2';
  var DEFAULT_ALERT_CFG = {
    lowStock: 20, highValue: 5000, staleDays: 30, on: true,
    excludeKeywords: '游戏币,卡牌,彩票,卡游,卡片,积分币,代币'
  };
  function loadAlertCfg() {
    try {
      var raw = localStorage.getItem(ALERT_CFG_KEY);
      var o = raw ? JSON.parse(raw) : null;
      if (!o) return Object.assign({}, DEFAULT_ALERT_CFG);
      return {
        lowStock: typeof o.lowStock === 'number' ? o.lowStock : DEFAULT_ALERT_CFG.lowStock,
        highValue: typeof o.highValue === 'number' ? o.highValue : DEFAULT_ALERT_CFG.highValue,
        staleDays: typeof o.staleDays === 'number' ? o.staleDays : DEFAULT_ALERT_CFG.staleDays,
        on: o.on !== false,
        excludeKeywords: typeof o.excludeKeywords === 'string' ? o.excludeKeywords : DEFAULT_ALERT_CFG.excludeKeywords
      };
    } catch (e) { return Object.assign({}, DEFAULT_ALERT_CFG); }
  }
  function saveAlertCfg(cfg) {
    try { localStorage.setItem(ALERT_CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  /* ---------- 统计：KPI / 预警 / 消耗分析 / 滞销分析 ---------- */
  function computeKpis() {
    var totalWh = WAREHOUSES.length;
    var totalRack = 0, totalCap = 0, totalStock = 0;
    WAREHOUSES.forEach(function (wh) {
      LAYOUTS[wh.id].racks.forEach(function (r) {
        totalRack++;
        r.levels.forEach(function (l) { totalCap += l.capacity; totalStock += l.stock; });
      });
    });
    var weekIn = 0, weekOut = 0;
    var now = Date.now();
    FLOWS.forEach(function (f) {
      if (now - f.time.getTime() > 7 * 864e5) return;
      if (f.type === 'in') weekIn += f.qty; else weekOut += f.qty;
    });
    var alerts = computeAlerts(loadAlertCfg());
    return {
      wh: totalWh, rack: totalRack,
      cap: totalCap, stock: totalStock,
      rate: totalCap ? Math.min(100, Math.round(totalStock / totalCap * 1000) / 10) : 0,
      weekIn: weekIn, weekOut: weekOut,
      alertCount: alerts.length
    };
  }

  function computeAlerts(cfg) {
    cfg = cfg || loadAlertCfg();
    var out = [];
    WAREHOUSES.forEach(function (wh) {
      var layout = LAYOUTS[wh.id];
      if (!layout || !layout.racks) return;
      layout.racks.forEach(function (r) {
        r.levels.forEach(function (l) {
          /* 空货位（无货品）不参与预警：无导入数据时所有层 stock=0，
             否则每个空格都误报「低库存」（看板曾因此显示 144 条噪音预警） */
          if (!l.goods || !l.goods.length) return;
          /* 礼品排除：货位上任一货品名称/品类命中关键词则整层跳过 */
          var cat = CATEGORIES.filter(function (c) { return c.key === l.cat; })[0];
          var catName = cat ? cat.name : (l.cat || '');
          var excluded = l.goods.some(function (g) {
            return isExcludedConsumeItem(g.name, catName, cfg);
          }) || isExcludedConsumeItem('', catName, cfg);
          if (excluded) return;
          var value = l.goods.reduce(function (s, g) { return s + g.qty * g.price; }, 0);
          if (cfg.on && l.stock <= cfg.lowStock) {
            out.push({
              level: 'low', wh: wh.name, rackCode: r.code, levelNo: l.level,
              cat: cat ? cat.name : l.cat, stock: l.stock, threshold: cfg.lowStock,
              msg: '库存 ' + l.stock + ' ≤ 阈值 ' + cfg.lowStock
            });
          }
          if (cfg.on && value >= cfg.highValue) {
            out.push({
              level: 'warn', wh: wh.name, rackCode: r.code, levelNo: l.level,
              cat: cat ? cat.name : l.cat, value: value, threshold: cfg.highValue,
              msg: '占用 ¥' + value.toLocaleString() + ' ≥ ¥' + cfg.highValue.toLocaleString()
            });
          }
        });
      });
    });
    return out;
  }

  /* ---------- 库存数据导入（支持 ≥50000 条，分批解析） ----------
     STOCK_IMPORT 存聚合后的统计（不存原始行，避免 localStorage 溢出）：
     { history: { totalRows, bySku: { sku: { name, qty, lastTime } }, importedAt },
       current: { ... } }
     computeConsume 优先用导入数据，回退到 FLOWS */
  var STOCK_IMPORT_KEY = 'inventory_check_stock_import_v1';
  var STOCK_IMPORT = { history: null, current: null };
  function loadStockImport() {
    try {
      var raw = localStorage.getItem(STOCK_IMPORT_KEY);
      var o = raw ? JSON.parse(raw) : null;
      if (!o || typeof o !== 'object') return { history: null, current: null };
      return {
        history: o.history && o.history.bySku ? o.history : null,
        current: o.current && o.current.bySku ? o.current : null
      };
    } catch (e) { return { history: null, current: null }; }
  }
  function saveStockImport() {
    try { localStorage.setItem(STOCK_IMPORT_KEY, JSON.stringify(STOCK_IMPORT)); } catch (e) {}
  }
  /* 首次构建：先读回持久化的导入数据，再建布局（货品池来自导入数据）、
     覆盖货架自定义，最后生成流水。顺序不可颠倒。 */
  STOCK_IMPORT = loadStockImport();
  rebuildLayouts();
  applyRackCustom(); /* 首次构建后把用户自定义编号/名称覆盖到 LAYOUTS */
  rebuildFlows();   /* 依赖 STOCK_IMPORT，必须在其初始化之后 */
  /* 解析单文件：分批处理 50000+ 条，每批 BATCH 条，setTimeout(0) 让出主线程避免卡 UI */
  function parseStockImport(file, mode, onDone) {
    if (typeof XLSX === 'undefined') { toast('Excel 解析库未加载', 'error'); return; }
    var prog = $('stockImportProgress');
    var fill = $('stockImportBarFill');
    var txt = $('stockImportBarText');
    if (prog) prog.hidden = false;
    if (fill) fill.style.width = '0%';
    if (txt) txt.textContent = '读取文件...';

    var reader = new FileReader();
    reader.onerror = function () {
      if (txt) txt.textContent = '文件读取失败';
      showModal('文件读取失败，请重试', 'error');
    };
    reader.onload = function (e) {
      try {
        var data = new Uint8Array(e.target.result);
        if (txt) txt.textContent = '解析工作表...';
        var wb = XLSX.read(data, { type: 'array', raw: false, cellDates: true, cellNF: false, cellText: true });
        if (!wb.SheetNames || !wb.SheetNames.length) { toast('文件中没有工作表', 'error'); return; }
        var sheet = wb.Sheets[wb.SheetNames[0]];
        var aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
        if (!aoa.length) { toast('文件内容为空', 'error'); return; }
        var headers = aoa[0].map(function (s) { return String(s || '').trim().toLowerCase(); });
        /* 列匹配：SKU / 编号 / 数量 / 名称 / 时间 / 类型 */
        /* 列匹配：兼容两种表头
           A) 库存变更查询标准表头（19 列，见 downloadStockImportTemplate）
              仓库/商品名称/商品编码/商品分类/单位/原数量/变更数量/变更后数量/
              变更金额/变更含税金额/变更类型/摘要/单号/备注/变更时间/账期/供应商/操作人/操作终端
           B) 通用简表（SKU/名称/数量/时间/类型），保留兼容便于历史文件可用 */
        var colSku = -1, colName = -1, colQty = -1, colTime = -1, colType = -1,
            colWh = -1, colCat = -1, colNo = -1, colBy = -1, colQtyAfter = -1, colAmount = -1;
        headers.forEach(function (h, i) {
          if (colWh < 0 && /^(仓库|仓库名称|库房)$/.test(h)) colWh = i;
          if (colSku < 0 && /^(商品编码|商品编号|sku|编码|货号|商品码|条码)$/.test(h)) colSku = i;
          if (colName < 0 && /^(商品名称|名称|品名|商品名|礼品名)$/.test(h)) colName = i;
          if (colCat < 0 && /^(商品分类|分类|品类)$/.test(h)) colCat = i;
          /* 优先匹配「变更数量」；无此列才回退到通用「数量」 */
          if (colQty < 0 && /^(变更数量|变动数量|出库数量|入库数量|消耗量|库存量|数量|qty)$/.test(h)) colQty = i;
          if (colQtyAfter < 0 && /^(变更后数量|结存数量|剩余数量)$/.test(h)) colQtyAfter = i;
          if (colAmount < 0 && /^(变更金额|变更含税金额|金额)$/.test(h)) colAmount = i;
          if (colTime < 0 && /^(变更时间|时间|日期|date|记录时间)$/.test(h)) colTime = i;
          if (colType < 0 && /^(变更类型|类型|方向|出入库|type)$/.test(h)) colType = i;
          if (colNo < 0 && /^(单号|单据编号|流水号)$/.test(h)) colNo = i;
          if (colBy < 0 && /^(操作人|经办人|经手人|制单人)$/.test(h)) colBy = i;
        });
        /* 列匹配失败时按列序兜底：标准表头前 8 列位置固定，
           避免因个别表头多空格/全半角差异导致整表导入失败 */
        if (colSku < 0 && headers.length >= 3) colSku = 2;
        if (colName < 0 && headers.length >= 2) colName = 1;
        if (colQty < 0 && headers.length >= 7) colQty = 6;
        if (colSku < 0 || colQty < 0) {
          if (txt) txt.textContent = '缺少必填列';
          showModal('缺少必填列：需要「商品编码/SKU」和「变更数量/数量」列', 'error');
          if (prog) prog.hidden = true;
          return;
        }
        var total = aoa.length - 1;
        if (txt) txt.textContent = '共 ' + total + ' 行，分批解析中...';
        var bySku = {};
        /* 明细行：保留原始记录供「出入库动态」页使用。
           只存聚合会在流水页丢失去向/单号/操作人等字段；
           限 5000 条以免撑爆 localStorage，超出部分仅计入聚合。 */
        var detailRows = [];
        var DETAIL_CAP = 5000;
        var BATCH = 2000;
        var idx = 1;
        var skipBad = 0;
        function batch() {
          var end = Math.min(idx + BATCH, aoa.length);
          for (; idx < end; idx++) {
            var row = aoa[idx];
            var sku = String(row[colSku] || '').trim();
            if (!sku) { skipBad++; continue; }
            /* 防科学计数法 */
            if (/e\+/i.test(sku)) sku = Number(sku).toFixed(0);
            var qty = parseFloat(row[colQty]);
            if (isNaN(qty) || qty === 0) { skipBad++; continue; }
            /* 方向判定优先级：
               1) 变更类型列（兑换/领用/退货…）无法直接映射出入库，故以数量符号为准
                  —— 库存变更查询中「变更数量」为负表示出库（消耗），为正表示入库；
               2) 数量为正时，若类型列含 in/入库 则仍判为入库，否则默认出库（消耗场景为主） */
            var sign = qty > 0 ? 1 : -1;
            var mag = Math.abs(qty);
            var typeWord = colType >= 0 ? String(row[colType] || '').trim() : '';
            var type;
            if (sign < 0) {
              type = 'out';
            } else if (/入库|进货|收货|入库单/.test(typeWord) || /^in$/i.test(typeWord)) {
              type = 'in';
            } else {
              type = 'out';
            }
            var name = colName >= 0 ? String(row[colName] || '').trim() : '';
            var wh = colWh >= 0 ? String(row[colWh] || '').trim() : '';
            var cat = colCat >= 0 ? String(row[colCat] || '').trim() : '';
            var orderNo = colNo >= 0 ? String(row[colNo] || '').trim() : '';
            var by = colBy >= 0 ? String(row[colBy] || '').trim() : '';
            var t = colTime >= 0 ? row[colTime] : '';
            var tObj = t ? new Date(t) : null;
            if (tObj && isNaN(tObj.getTime())) tObj = null;
            /* 采集明细行：出入库动态页直接渲染这些记录 */
            if (detailRows.length < DETAIL_CAP) {
              detailRows.push({
                type: type, sku: sku, goods: name, qty: mag,
                wh: wh, cat: cat, orderNo: orderNo, by: by,
                kind: typeWord, time: tObj ? tObj.getTime() : (mode === 'current' ? Date.now() : 0)
              });
            }
            if (!bySku[sku]) {
              bySku[sku] = {
                name: name, qty: 0, lastTime: null,
                inQty: 0, outQty: 0, whs: {}, cats: {}, orders: 0, staff: {}
              };
            }
            var rec = bySku[sku];
            if (name && !rec.name) rec.name = name;
            if (type === 'in') rec.inQty += mag; else rec.outQty += mag;
            rec.qty = rec.outQty;                 /* 消耗分析以出库量为准 */
            /* 结存数量（变更后数量列）：同一 SKU 按变更时间取最新一条，反映当前真实库存 */
            if (colQtyAfter >= 0) {
              var qa = parseFloat(row[colQtyAfter]);
              if (!isNaN(qa)) {
                var qaT = tObj ? tObj.getTime() : 0;
                if (typeof rec.qtyAfterTime !== 'number' || qaT >= rec.qtyAfterTime) {
                  rec.qtyAfter = qa;
                  rec.qtyAfterTime = qaT;
                }
              }
            }
            if (wh) rec.whs[wh] = (rec.whs[wh] || 0) + 1;
            if (cat) rec.cats[cat] = (rec.cats[cat] || 0) + 1;
            if (orderNo) rec.orders++;
            if (by) rec.staff[by] = (rec.staff[by] || 0) + 1;
            if (tObj && (!rec.lastTime || tObj > rec.lastTime)) rec.lastTime = tObj;
          }
          var pct = Math.round(idx / aoa.length * 100);
          if (fill) fill.style.width = pct + '%';
          if (txt) txt.textContent = '已解析 ' + (idx - 1) + ' / ' + total + ' 行（' + pct + '%）';
          if (idx < aoa.length) {
            setTimeout(batch, 0);
          } else {
            var skuCount = Object.keys(bySku).length;
            var result = {
              totalRows: total - skipBad, skuCount: skuCount, skipBad: skipBad,
              bySku: bySku, detail: detailRows,
              detailTruncated: total - skipBad > DETAIL_CAP,
              importedAt: new Date().toISOString()
            };
            STOCK_IMPORT[mode] = result;
            saveStockImport();
            /* 导入后立刻重建布局与流水：让 3D 园区库存、KPI 与「出入库动态」页马上反映真实数据 */
            rebuildLayouts();
            applyRackCustom();
            rebuildFlows();
            if (txt) txt.textContent = '完成：' + skuCount + ' 个 SKU · ' + (total - skipBad) + ' 条有效';
            if (prog) setTimeout(function () { prog.hidden = true; }, 1800);
            renderStockImportOverview();
            /* 刷新各分析视图 */
            renderConsume();
            renderSlowSell();
            renderStockKpis();
            renderFlow();
            if (flowPager) { flowPager.pageSize = flowPager.pageSize || 10; flowPager.reset(); }
            if (onDone) onDone(result);
            toast((mode === 'history' ? '历史' : '当前') + '数据导入成功：' + skuCount + ' 个 SKU · ' + FLOWS.length + ' 条流水', 'success');
          }
        }
        setTimeout(batch, 0);
      } catch (err) {
        if (txt) txt.textContent = '解析失败';
        showModal('导入失败：' + (err && err.message ? err.message : '未知错误'), 'error');
        if (prog) prog.hidden = true;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* 渲染已导入数据概览 */
  function renderStockImportOverview() {
    var box = $('stockImportOverview');
    if (!box) return;
    var html = '';
    var h = STOCK_IMPORT.history, c = STOCK_IMPORT.current;
    if (!h && !c) {
      box.innerHTML = '<div class="alert-empty">尚未导入数据，消耗分析将使用系统内置近 7 天流水</div>';
      return;
    }
    if (h) {
      var hQty = 0; Object.keys(h.bySku).forEach(function (k) { hQty += h.bySku[k].qty; });
      html += '<div class="stock-import-stat"><span class="stock-import-stat-k">历史数据</span>' +
        '<span class="stock-import-stat-v">' + h.skuCount + ' SKU · ' + hQty + ' 件出库</span></div>';
      html += '<div class="stock-import-stat"><span class="stock-import-stat-k">导入时间</span>' +
        '<span class="stock-import-stat-v">' + new Date(h.importedAt).toLocaleString('zh-CN', { hour12: false }) + '</span></div>';
    }
    if (c) {
      var cQty = 0; Object.keys(c.bySku).forEach(function (k) { cQty += c.bySku[k].qty; });
      html += '<div class="stock-import-stat"><span class="stock-import-stat-k">当前数据</span>' +
        '<span class="stock-import-stat-v">' + c.skuCount + ' SKU · ' + cQty + ' 件出库</span></div>';
      html += '<div class="stock-import-stat"><span class="stock-import-stat-k">导入时间</span>' +
        '<span class="stock-import-stat-v">' + new Date(c.importedAt).toLocaleString('zh-CN', { hour12: false }) + '</span></div>';
    }
    box.innerHTML = html;
  }

  /* 礼品排除关键词：与预警配置共用 */
  function getExcludeKeywordList(cfg) {
    cfg = cfg || loadAlertCfg();
    var raw = (cfg && cfg.excludeKeywords != null) ? String(cfg.excludeKeywords) : DEFAULT_ALERT_CFG.excludeKeywords;
    return raw.split(/[,，、;；\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function isExcludedConsumeItem(name, cat, cfg) {
    var t = String(name || '') + ' ' + String(cat || '');
    if (!t.trim()) return false;
    var keys = getExcludeKeywordList(cfg);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] && t.indexOf(keys[i]) >= 0) return true;
    }
    return false;
  }
  function finalizeConsumeRows(rows) {
    rows = (rows || []).filter(function (r) {
      return !isExcludedConsumeItem(r.name, r.cat);
    });
    rows.sort(function (a, b) { return b.qty - a.qty; });
    var total = rows.reduce(function (s, r) { return s + r.qty; }, 0);
    var avg = rows.length ? total / rows.length : 0;
    var max = rows.length ? rows[0].qty : 0;
    return rows.map(function (r) {
      return {
        sku: r.sku,
        name: r.name,
        qty: r.qty,
        source: r.source,
        tier: r.qty >= avg * 1.5 ? 'high' : (r.qty <= avg * 0.5 ? 'low' : 'mid'),
        max: max
      };
    });
  }

  /* 礼品消耗分析：近 30 天出库数量 → 高/低消耗分层
     优先用 STOCK_IMPORT 数据，回退到 FLOWS；已排除游戏币/卡牌/彩票 */
  function computeConsume() {
    /* 优先用当前导入数据 */
    if (STOCK_IMPORT.current && STOCK_IMPORT.current.bySku) {
      var bySku = {};
      Object.keys(STOCK_IMPORT.current.bySku).forEach(function (sku) {
        var d = STOCK_IMPORT.current.bySku[sku];
        bySku[sku] = d.qty;
      });
      /* 补齐零消耗礼品 */
      var poolCur = buildImportGoodsPool();
      poolCur.forEach(function (g) { if (bySku[g.sku] === undefined) bySku[g.sku] = 0; });
      var rows = Object.keys(bySku).map(function (sku) {
        var g = poolCur.filter(function (x) { return x.sku === sku; })[0];
        var imported = STOCK_IMPORT.current.bySku[sku];
        return {
          sku: sku,
          name: (imported && imported.name) || (g ? g.name : sku),
          cat: (imported && imported.cat) || (g ? g.cat : ''),
          qty: bySku[sku],
          source: 'imported'
        };
      });
      return finalizeConsumeRows(rows);
    }
    /* 回退：FLOWS 近 30 天 */
    var bySku2 = {};
    var now = Date.now();
    FLOWS.forEach(function (f) {
      if (f.type !== 'out') return;
      if (now - f.time.getTime() > 30 * 864e5) return;
      bySku2[f.sku] = (bySku2[f.sku] || 0) + f.qty;
    });
    /* 补齐零消耗礼品，保证分层完整
       注意：本分支的累加容器是 bySku2（导入分支才用 bySku），此处必须一致，
       否则会读取到另一个分支的局部变量并抛 TypeError。 */
    var poolFb = buildImportGoodsPool();
    poolFb.forEach(function (g) {
      if (bySku2[g.sku] === undefined) bySku2[g.sku] = 0;
    });
    var rowsFb = Object.keys(bySku2).map(function (sku) {
      var g = poolFb.filter(function (x) { return x.sku === sku; })[0];
      return {
        sku: sku,
        name: g ? g.name : sku,
        cat: g ? g.cat : '',
        qty: bySku2[sku]
      };
    });
    return finalizeConsumeRows(rowsFb);
  }

  /* 滞销库存：仍有库存但超过阈值天数未出库 / 高占用
     结合消耗数据（consumeMap: { sku: qty }）给出处理建议 */
  function slowAdvice(r, cq, cfg) {
    if (r.idleDays >= 90 && cq === 0) return { text: '清仓促销', level: 'danger' };
    if (r.idleDays >= cfg.staleDays && cq === 0) return { text: '清仓促销', level: 'danger' };
    if (r.idleDays >= 60 && r.value >= cfg.highValue) return { text: '调拨热销仓', level: 'warn' };
    if (r.value >= cfg.highValue && cq === 0) return { text: '调拨热销仓', level: 'warn' };
    if (r.idleDays >= cfg.staleDays && cq > 0) return { text: '持续观察', level: 'info' };
    if (r.qty <= cfg.lowStock && cq > 0) return { text: '建议补货', level: 'ok' };
    if (r.value >= cfg.highValue) return { text: '调拨热销仓', level: 'warn' };
    return { text: '暂不处理', level: 'muted' };
  }
  function computeSlowSell(cfg, consumeMap) {
    var cmap = consumeMap || {};
    var lastOut = {};
    FLOWS.forEach(function (f) {
      if (f.type !== 'out') return;
      if (!lastOut[f.sku] || f.time > lastOut[f.sku]) lastOut[f.sku] = f.time;
    });
    /* SKU → 品类映射表：循环外建一次，避免在双层遍历里重复构建（O(货位) 次重建） */
    var catOf = {};
    buildImportGoodsPool().forEach(function (g) { catOf[g.sku] = g.cat; });
    var now = Date.now();
    var rows = [];
    WAREHOUSES.forEach(function (wh) {
      LAYOUTS[wh.id].racks.forEach(function (r) {
        r.levels.forEach(function (l) {
          l.goods.forEach(function (g) {
            var lo = lastOut[g.sku];
            var idleDays = lo ? Math.floor((now - lo.getTime()) / 864e5) : 999;
            var value = g.qty * g.price;
            if (g.qty > 0 && (idleDays >= cfg.staleDays || value >= cfg.highValue)) {
              var cq = cmap[g.sku] || 0;
              var row = {
                sku: g.sku, name: g.name, qty: g.qty, value: value,
                wh: wh.name, rackCode: r.code,
                cat: (CATEGORIES.filter(function (c) { return c.key === catOf[g.sku]; })[0] || {}).name || '-',
                idleDays: idleDays, lastOut: lo ? lo : null, consumeQty: cq,
                stale: idleDays >= cfg.staleDays,
                high: value >= cfg.highValue
              };
              row.advice = slowAdvice(row, cq, cfg);
              rows.push(row);
            }
          });
        });
      });
    });
    /* 跨仓库同 SKU 去重合并，保留占用最高的一条 */
    var map = {};
    rows.forEach(function (r) {
      if (!map[r.sku] || r.value > map[r.sku].value) map[r.sku] = r;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  /* ---------- 3D 园区渲染 ---------- */
  var stage = null, scene = null;
  /* 默认俯角 / 旋转角：集中定义一处，避免 JS 与 CSS 各写一份而漂移。
     56° 太陡（接近正交俯视，透视被压扁）；48° 能充分呈现"近大远小"。
     CSS 里 .park-scene 的初值只是首帧占位，真正生效的是 JS 的 applyCam。 */
  var CAM_RX = 48, CAM_RZ = -34;
  var cam = { rx: CAM_RX, rz: CAM_RZ, scale: 1.45, ox: -96, oy: -60 };
  var autoRotate = true, selectedRack = null, curWh = WAREHOUSES[0].id;
  var RACK_GAP = { x: 108, y: 82 };
  /* 货架立体参数（CSS 3D 降级路径）。
     【根因·层高不足】此前 LEVEL_Z=26、RACK_D=34，层板只是薄薄一片平面，
     加上整链路无透视，层与层的屏幕 Y 差实测仅 20px、层高恒为 24px ——
     视觉上所有层挤在同一平面，"像一摞贴纸"，完全没有立体感。
     现在：层间距与货架进深同步加大，并给每层加"层板 + 立柱 + 侧板 + 背板"，
     让每一层本身成为一个可见的立方体腔室，光影才有承载面。 */
  var LEVEL_Z = 42;  /* 层间距：控制货架总高，避免立柱穿地 */
  var RACK_W = 62, RACK_D = 52;  /* 货架宽 / 进深：进深加大才有侧板与背板的空间 */
  /* 立柱宽：5 → 7 → 9。立柱改为真正竖直的柱体后（见下方 park-rack-post-v），
     9px 在 48° 俯角下投影约 6px，是远距下仍能一眼分辨的最小宽度。
     不影响 RACK_W 与 RACK_D 的布局推算（柱位取的是 x + RACK_W - POST_W 增量固定）。 */
  var POST_W = 9;
  var BOARD_T = 5;               /* 层板厚 */
  /* 3D 标签的透视深度：须与 CSS .park-stage 的 perspective 一致，
     否则 projectLabels() 算出的屏幕位置与浏览器实际渲染会有偏移。 */
  var PARK_PERSPECTIVE = 1500;

  function fillVar(rate) {
    var v = Math.max(0, Math.min(1, rate));
    if (v >= 0.75) return 'var(--fill-3)';
    if (v >= 0.5)  return 'var(--fill-2)';
    if (v >= 0.25) return 'var(--fill-1)';
    return 'var(--fill-0)';
  }

  function renderWhSwitch() {
    var box = $('parkWhSwitch');
    if (!box) return;
    var html = '';
    WAREHOUSES.forEach(function (wh) {
      var st = whStat(wh.id);
      html += '<button type="button" class="park-wh' + (wh.id === curWh ? ' active' : '') +
        '" role="tab" aria-selected="' + (wh.id === curWh) + '" data-wh="' + wh.id + '">' +
        '<span class="park-wh-name">' + escapeHtml(wh.name) + '</span>' +
        '<span class="park-wh-meta">' + wh.code + ' · ' + st.rack + ' 架 · 占用 ' + st.rate + '%</span>' +
        '</button>';
    });
    box.innerHTML = html;
    box.querySelectorAll('.park-wh').forEach(function (b) {
      b.addEventListener('click', function () {
        curWh = b.getAttribute('data-wh');
        selectedRack = null;
        /* 换仓后园区占位可能完全不同，需重新取景 */
        cssCamFitted = false;
        renderWhSwitch();
        renderPark();
        renderPanelEmpty();
        if (r3fReady && parkApp && parkApp.setView) parkApp.setView('reset');
      });
    });
  }

  function whStat(whId) {
    var racks = LAYOUTS[whId].racks;
    var cap = 0, stock = 0;
    racks.forEach(function (r) { r.levels.forEach(function (l) { cap += l.capacity; stock += l.stock; }); });
    return { rack: racks.length, cap: cap, stock: stock, rate: cap ? Math.min(100, Math.round(stock / cap * 100)) : 0 };
  }

  function renderLegend() {
    var box = $('parkLegend');
    if (!box) return;
    box.innerHTML = '<span class="park-legend-title">货位占用</span>' +
      '<span class="park-legend-scale">' +
      '<span class="park-legend-sw" style="background:var(--fill-0)"></span>' +
      '<span class="park-legend-sw" style="background:var(--fill-1)"></span>' +
      '<span class="park-legend-sw" style="background:var(--fill-2)"></span>' +
      '<span class="park-legend-sw" style="background:var(--fill-3)"></span>' +
      '</span>' +
      '<span class="park-legend-title">低 → 高</span>';
  }

  function renderPark() {
    /* React Three Fiber 就绪时由其接管渲染 */
    if (r3fReady && parkApp) {
      var _wh = WAREHOUSES.filter(function (w) { return w.id === curWh; })[0];
      if (_wh) {
        /* 闪屏修复：未挂载走 mount；已挂载用 rAF 防抖合并同帧多次 update，
           避免 openRack→renderPark→updateR3F→root.render 链式高频全量重渲 */
        if (!r3fMounted) {
          mountR3F(curWh, LAYOUTS[curWh], selectedRack);
        } else {
          if (r3fRafId) cancelAnimationFrame(r3fRafId);
          r3fRafId = requestAnimationFrame(function () {
            r3fRafId = null;
            updateR3F(curWh, LAYOUTS[curWh], selectedRack);
          });
        }
        var st0 = whStat(curWh);
        var h1 = $('parkHudWh'); if (h1) h1.textContent = _wh.name;
        var h2 = $('parkHudRack'); if (h2) h2.textContent = st0.rack + ' 个';
        var h3 = $('parkHudCat'); if (h3) h3.textContent = LAYOUTS[curWh].zones.length + ' 个分区';
        return;
      }
    }
    if (!scene) {
      stage = $('parkStage'); scene = $('parkScene');
      if (!stage || !scene) return;
      bindParkControls();
    }
    /* 明确标记：当前为 CSS 降级，方便排查 */
    if (stage) {
      stage.classList.remove('r3f-active');
      stage.setAttribute('data-render', 'css3d');
      var modeTip = $('parkRenderModeTip');
      if (!modeTip) {
        modeTip = document.createElement('div');
        modeTip.id = 'parkRenderModeTip';
        modeTip.style.cssText = 'position:absolute;left:12px;bottom:48px;z-index:20;background:rgba(30,50,80,0.82);color:#fff;padding:6px 10px;border-radius:8px;font-size:12px;font-family:system-ui,sans-serif;pointer-events:none;';
        stage.appendChild(modeTip);
      }
      modeTip.textContent = r3fReady ? '渲染中…' : 'CSS 3D 降级（R3F 未加载）';
      modeTip.style.background = r3fReady ? 'rgba(40,120,80,0.85)' : 'rgba(180,60,40,0.9)';
    }
    var wh = WAREHOUSES.filter(function (w) { return w.id === curWh; })[0];
    var layout = LAYOUTS[curWh];
    var html = '<div class="park-world">';
    html += '<div class="park-floor"></div>';
    /* 文字标签统一收集到屏幕空间覆盖层（不进 3D 变换链，避免被 rotateX 压扁） */
    var labelItems = [];

    /* 分区地台：按配置行列推导的真实占位（originX/originZ/spanX/spanZ 与 R3F 同一份数据），
       只把世界单位换算成 CSS 像素，保证两种渲染的布局完全一致。 */
    var U = RACK_GAP.x / PARK_GRID.colGap;   /* 世界单位 → CSS px 的统一换算系数 */
    layout.zones.forEach(function (z) {
      var w = (z.spanX || z.cols * PARK_GRID.colGap) * U + 44;
      var d = (z.spanZ || z.rows * PARK_GRID.rowGap) * U + 44;
      var ox = (typeof z.originX === 'number' ? z.originX * U : 0) + (RACK_W - (z.spanX || z.cols * PARK_GRID.colGap) * U) / 2;
      var oy = typeof z.originZ === 'number' ? z.originZ * U : 0;
      /* 建筑构件（入口门 / 主通道 / 隔墙）：只出标签不出地台色块，
         且标签文案走构件语义——这些分区没有 cols/rows/levels，
         拼「N 列 × N 行」会得到 undefined。 */
      if (z.kind) {
        labelItems.push({
          cls: 'park3d-zone' + (z.isGift ? ' gift' : '') + ' norack',
          html: '<span class="park3d-zone-n">' + escapeHtml(z.name) + '</span>' +
            '<span class="park3d-zone-m">' + escapeHtml(
              z.kind === 'door' ? '门洞 900 × 2100 · 内开' : (z.note || (z.dir === 'ns' ? '南北走向' : '东西走向'))
            ) + '</span>',
          wx: ox + w / 2, wy: oy + d - 4, wz: 30
        });
        return;
      }
      html += '<div class="park-bldg" style="left:' + ox + 'px;top:' + oy + 'px;width:' + w + 'px;height:' + d + 'px;">' +
        '<div class="park-bldg-face park-bldg-top" style="left:0;top:0;width:' + w + 'px;height:' + d + 'px;transform:translateZ(0.4px);"></div>' +
        '</div>';
      /* 分区标签移到屏幕空间层（见 projectLabels 注释） */
      labelItems.push({
        cls: 'park3d-zone' + (z.isGift ? ' gift' : ''),
        html: '<span class="park3d-zone-n">' + escapeHtml(z.name) + '</span>' +
          '<span class="park3d-zone-m">' + z.cols + ' 列 × ' + z.rows + ' 行 × ' + z.levels + ' 层</span>',
        wx: ox + w / 2, wy: oy + d - 4, wz: 30
      });
    });

    /* 仓库主建筑：立体体块（顶面 + 两个侧面 + 正面），给场景体量锚点。
       贴在园区左侧外围，随园区宽度一起外移，不压到货架区。 */
    var bW = 104, bD = 66, bH = 40;
    var parkMinX = Infinity;
    layout.zones.forEach(function (z) {
      if (typeof z.originX === 'number') parkMinX = Math.min(parkMinX, z.originX);
    });
    if (!isFinite(parkMinX)) parkMinX = 0;
    var bx = parkMinX * U - (bW + 46), by = -8;
    html += '<div class="park-bldg" style="left:' + bx + 'px;top:' + by + 'px;">' +
      /* 正面 */
      '<div class="park-bldg-face park-bldg-front" style="left:0;top:0;width:' + bW + 'px;height:' + bH + 'px;transform:translateZ(' + bH + 'px);"></div>' +
      /* 顶面 */
      '<div class="park-bldg-face park-bldg-top" style="left:0;top:0;width:' + bW + 'px;height:' + bD + 'px;transform:rotateX(-90deg) translateZ(' + bH + 'px);transform-origin:top left;"></div>' +
      /* 右侧 */
      '<div class="park-bldg-face park-bldg-side" style="left:0;top:0;width:' + bD + 'px;height:' + bH + 'px;transform:rotateY(90deg) translateZ(' + bW + 'px);transform-origin:left top;"></div>' +
      '<div class="park-bldg-skylight" style="left:16px;top:' + (bH + 10) + 'px;width:30px;height:16px;transform:translateZ(' + (bH + 1) + 'px);"></div>' +
      '<div class="park-bldg-skylight" style="left:56px;top:' + (bH + 10) + 'px;width:30px;height:16px;transform:translateZ(' + (bH + 1) + 'px);"></div>' +
      '</div>';
    labelItems.push({ cls: 'park3d-zone wh', html: escapeHtml(wh.name), wx: bx + bW / 2, wy: by + bH + 30, wz: 46 });

    /* 货架：每层是一个"立体腔室"（层板 + 前挡杆 + 侧板 + 背板 + 立柱），
       层层沿 Z 轴抬升。
       【根因·只有平面没有体积】旧实现每层只有一个 .park-rack-level 平面色块
       + 几个 8px 小方块，光照/阴影在纯平面上无处表现，旋转后完全退化成贴纸。
       现在每层补齐四个承重面与立柱，形成可读的立体腔室。
       坐标用 rebuildLayouts 推导的 wx/wz（与 R3F 同一份），按 U 换算成 CSS px。 */
    layout.racks.forEach(function (r) {
      var x = (typeof r.wx === 'number' ? r.wx : r.col * PARK_GRID.colGap) * U;
      var y = (typeof r.wz === 'number' ? r.wz : r.row * PARK_GRID.rowGap) * U;
      var cls = 'park-rack' + (r.isGift ? ' gift' : '') + (selectedRack && selectedRack.id === r.id ? ' selected' : '');
      var lvCount = r.levels.length;
      /* 货架总高（Z 方向）：顶层所在高度 + 顶板余量。
         【踩坑】曾写成 6 + lvCount * LEVEL_Z，多算了一整层的高度（4 层时多 46px），
         立柱因此高出货架一大截、戳出园区外，视觉上像"一排钉子"。
         顶层 lz = 6 + (lvCount-1) * LEVEL_Z，故总高取该值 + 顶板厚。 */
      var rackTopZ = 6 + Math.max(0, lvCount - 1) * LEVEL_Z + BOARD_T;
      var inner = '';

      /* 地面投影：跟着货架走，压在地面 */
      inner += '<div class="park-rack-shadow" style="left:' + (x + 8) + 'px;top:' + (y + 10) + 'px;width:' + RACK_W + 'px;height:' + RACK_D + 'px;"></div>';

      /* 底座：横跨整架宽度的地面承台，落在货架进深的最后端（贴地）。
         立柱改为真正竖直后柱脚自带落点，底座不再承担"防悬空"的主职责，
         这里只作为"柱脚与地面的过渡"，宽度略大于货架、把 4 根柱的脚连成一体。 */
      inner += '<div class="park-rack-base" style="left:' + (x - 2) + 'px;top:' + (y + RACK_D - POST_W) + 'px;' +
        'width:' + (RACK_W + 4) + 'px;height:' + (POST_W + 4) + 'px;transform:translateZ(0);"></div>';

      /* 立柱：四角竖直柱体，从地面直达顶板 —— 这是"货架"而非"一摞盘子"的核心语义。
         【根因重定位 · 此前三次改法都没解决用户反馈的"只有板没有立柱"】
         旧写法：left:x; top:y; width:POST_W; height:rackTopZ; transform:translateZ(0)。
         它只给了 x/y 偏移、z 恒为 0，因此躺在场景的 **XY 地面平面** 内，
         经场景 rotateX(48°) 之后变成一条**贴在地面上的扁平色带**，
         而不是从地面"站起来"的柱子 —— 俯视时与地面网格糊在一起，完全读不出立柱。
         【正确做法】竖直柱必须建在 **XZ 平面**：用 rotateX(-90deg) 把本地 y 映射到世界 z。
         场景本身已 rotateX(48°)，净角 48-90 = -42°，柱面与视线夹角合适，
         会呈现为真正的竖直构件（实测屏幕 18.5×101px，肉眼可辨）。
         【transform-origin 必须 0 0】CSS rotateX 默认绕元素中心旋转，
         中心为轴会让柱子"半沉地半朝天"（此前误判为"净角 -42° 会斜插进地"的真正原因）。
         以底端为轴才是"从地面立起来"。 */
      /* 立柱：按层分段生成短柱，避免一根超长柱穿出地面 */
      [0, 1].forEach(function (side) {
        [0, 1].forEach(function (end) {
          var px = side === 0 ? x : x + RACK_W - POST_W;
          var py = end === 0 ? y : y + RACK_D - POST_W;
          for (var pi = 0; pi < lvCount; pi++) {
            var pz = 6 + pi * LEVEL_Z;
            var ph = LEVEL_Z * 0.92;
            inner += '<div class="park-rack-post-v" style="left:' + px + 'px;top:' + py + 'px;' +
              'width:' + POST_W + 'px;height:' + ph + 'px;' +
              'transform:translateZ(' + pz + 'px) rotateX(-90deg);"></div>';
          }
        });
      });
      /* 层间横撑：连接同侧前后立柱，把四角柱串成框架。
         没有横撑时四根柱在屏幕上仍是四个孤立竖条，看不出"架子"；
         有了横撑，每层形成闭合的"格"，层与层的分隔也由它强化。 */
      r.levels.forEach(function (lv, li) {
        var bz = 6 + li * LEVEL_Z;
        [0, 1].forEach(function (side) {
          var bx = side === 0 ? x : x + RACK_W - POST_W / 2;
          var bTop = y + POST_W / 2, bH = RACK_D - POST_W;
          inner += '<div class="park-rack-brace-v" style="left:' + bx + 'px;top:' + bTop + 'px;' +
            'width:' + (POST_W / 2) + 'px;height:' + bH + 'px;' +
            'transform:translateZ(' + bz + 'px) rotateX(-90deg);"></div>';
        });
      });
      /* 顶板：封顶，强化体量（压在所有层之上，与立柱同高）。
         比层板内缩 4px（见 CSS 注释）：否则顶板高光面会向下盖住立柱上段。 */
      inner += '<div class="park-rack-top" style="left:' + (x + 4) + 'px;top:' + (y + 4) + 'px;width:' + (RACK_W - 8) + 'px;height:' + (RACK_D - 8) + 'px;' +
        'transform:translateZ(' + rackTopZ + 'px);"></div>';

      r.levels.forEach(function (lv, li) {
        var lz = 6 + li * LEVEL_Z;
        var rate = lv.capacity ? Math.min(1, lv.stock / lv.capacity) : 0;
        var on = selectedRack && selectedRack.id === r.id && selectedRack.level === lv.level;
        var fill = fillVar(rate);
        /* 层板顶面：可点击的拾取面（保留原类名与 data 属性，事件绑定不用改） */
        inner += '<div class="park-rack-level' + (on ? ' selected' : '') + '" data-rack="' + r.id + '" data-level="' + lv.level + '" ' +
          'style="left:' + x + 'px;top:' + y + 'px;width:' + RACK_W + 'px;height:' + RACK_D + 'px;' +
          'transform:translateZ(' + lz + 'px);">' +
          /* 用 background-color 而非 background 简写：简写会把 background-image
             重置为 none，层板上表面那道「白色高光 + 淡蓝反光」就没了，
             板面退化成纯色平面，旋转时立体感明显变弱。 */
          '<span class="park-rack-board" style="background-color:#e8edf3;"></span>' +
          /* 背板：挡住穿透，形成腔室纵深 */
          '<span class="park-rack-back"></span>' +
          /* 左右侧板：给宽度方向的两个面，制造明暗对比 */
          '<span class="park-rack-side l"></span>' +
          '<span class="park-rack-side r"></span>' +
          /* 前挡杆：横贯正面的立体条，是层与层的分隔线 */
          '<span class="park-rack-rail"></span>' +
          '</div>';

        /* 层板上的货品方块：随层抬升，尺寸加大才有体积感 */
        var n = Math.max(1, Math.min(5, Math.round(rate * 5)));
        for (var k = 0; k < n; k++) {
          var cw = (RACK_W - 16) / n;
          inner += '<div class="park-rack-crate" style="left:' + (x + 8 + k * cw) + 'px;top:' + (y + 12) + 'px;' +
            'width:' + (cw - 3) + 'px;height:' + (RACK_D - 22) + 'px;' +
            'transform:translateZ(' + (lz + BOARD_T) + 'px);"></div>';
        }
        /* 选中层的层名标签：收集到标签层（不进 3D 链，见 projectLabels 注释） */
        if (on) {
          labelItems.push({
            cls: 'park3d-tag level' + (lv.name ? ' named' : ''),
            html: escapeHtml(lv.name || ('第 ' + lv.level + ' 层')),
            wx: x + RACK_W / 2, wy: y - 10, wz: lz + 10
          });
        }
      });

      /* 货架编号 + 名称：浮于货架顶端之上 */
      labelItems.push({
        cls: 'park3d-tag rack' +
          ((selectedRack && selectedRack.id === r.id) ? ' active' : '') +
          (r.name ? ' named' : ''),
        html: '<span class="park3d-code">' + escapeHtml(r.code) + '</span>' +
          (r.name ? '<span class="park3d-name">' + escapeHtml(r.name) + '</span>' : ''),
        wx: x + RACK_W / 2, wy: y, wz: rackTopZ + 16
      });
      html += '<div class="' + cls + '" data-rack="' + r.id + '">' + inner + '</div>';
    });

    /* 标签探针：零尺寸的锚点元素，放在 3D 链内、坐标与对应标签一致。
       projectLabels() 用 getBoundingClientRect() 读它算出的屏幕位置，
       再把屏幕空间的文字标签贴过去 —— 透视/旋转/perspective-origin
       全部由浏览器计算，无需在 JS 里重复实现投影公式。

       【必须放在 .park-world 内部】探针要靠 translateZ 抬到货架顶端，
       而 translateZ 只有在同一个 preserve-3d 上下文里才具有"高度"语义。
       早先把它追加在 </div>（.park-world 闭合）之后，成为 #parkScene 的直接子元素，
       于是脱离了场景的 3D 定位上下文 —— translateZ 退化成"离观察者更近的平面缩放"，
       探针被整体甩到画面上方：实测探针屏幕 Y≈100~310，而货架几何在 Y≈510~720，
       标签与货架错开约 400px，看起来像"标签飘在园区外面"。
       正确做法：探针与货架同为 .park-world 的子元素，共用同一套 3D 变换。 */
    html += labelItems.map(function (it, i) {
      return '<i class="park-label-probe" data-probe="' + i + '" style="left:' + it.wx + 'px;top:' + it.wy +
        'px;transform:translateZ(' + it.wz + 'px);"></i>';
    }).join('');

    html += '</div>';

    scene.innerHTML = html;

    /* 文字标签渲染到屏幕空间覆盖层：与 .park-scene 同级，
       每帧由 projectLabels() 按 3D 坐标投影成像素位置。
       【为什么不放 3D 链内】场景的 rotateX 会把标签内的中文字形一起压扁
       （实测点击某层后标签宽度仅 21px，文字竖排不可见）。 */
    var labelLayer = $('parkLabelLayer');
    if (labelLayer) {
      /* 每条标签额外带一根<i class="park-label-link">：从标签中心画回 3D 锚点的细线。
         避让后标签可能被下推几十像素，没有连线时用户会以为标签属于旁边那个货架。
         线本身是纯 2D 绘制（不参与碰撞检测），长度随位移实时更新。 */
      labelLayer.innerHTML = labelItems.map(function (it, i) {
        return '<i class="park-label-link" data-link="' + i + '"></i>' +
          '<div class="' + it.cls + '" data-i="' + i + '" ' +
          'data-wx="' + it.wx + '" data-wy="' + it.wy + '" data-wz="' + it.wz + '">' + it.html + '</div>';
      }).join('');
    }

    /* 首次渲染（或园区/画布尺寸变化后）自动取景：
       用 doFitView 按实际占位算缩放与居中，避免固定 cam 参数把园区挤出画面 */
    if (!cssCamFitted) { cssCamFitted = true; doFitView(); }
    else applyCam();

    /* 事件绑定（每次重渲染后重绑） */
    scene.querySelectorAll('.park-rack-level').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openRack(curWh, el.getAttribute('data-rack'), parseInt(el.getAttribute('data-level'), 10));
      });
    });

    var st = whStat(curWh);
    var hud = $('parkHudWh'); if (hud) hud.textContent = wh.name;
    var hr = $('parkHudRack'); if (hr) hr.textContent = st.rack + ' 个';
    var hc = $('parkHudCat'); if (hc) hc.textContent = layout.zones.length + ' 个分区';
  }

  function applyCam() {
    if (!scene) return;
    /* 平移放在旋转之后，才是在「屏幕空间」做居中偏移（放前面会跟着一起被旋转） */
    scene.style.transform =
      'rotateX(' + cam.rx + 'deg) rotateZ(' + cam.rz + 'deg) scale(' + cam.scale + ') ' +
      'translate(' + cam.ox + 'px,' + cam.oy + 'px)';
    projectLabels();
  }

  /* ---------- 3D 标签的屏幕空间投影 ----------
     【根因·点击层后看不到名称】此前标签（.park3d-tag）是 .park-world 的子元素，
     放在 3D 变换链内。场景已有 rotateX(48deg)，我们又给标签叠加 rotateX(-48deg)
     抵消，但标签的 translateZ 仍会把它沿深度方向压缩 ——
     实测点击第 3 层后标签 DOM 存在、opacity=1、visibility=visible，
     可 boundingRect 宽度只有 21px（正常 60~100px），中文被压成竖排一列，等于看不见。
     根因是【文字元素不能放在 3D 变换链里】：3D 变换对文本栅格化后的
     字形同样生效，无法靠反向旋转完全抵消 translateZ 的深度压缩。

     【修复】把文字标签移出 3D 链，改为【屏幕空间覆盖层】：
     标签挂在 .park-stage 下（与 canvas 同级、position:absolute），
     每次视角变化时用「3D 世界坐标 → 屏幕坐标」的解析投影算出 left/top，
     直接用像素定位。文字始终正向、不受任何 3D 变换影响，
     同时也能正确地被 perspective 缩放（近大远小）。
     投影公式来自 CSS transform 的矩阵分解，与浏览器实际渲染一致。 */
  function projectLabels() {
    var host = $('parkLabelLayer');
    if (!host) return;
    var tags = host.querySelectorAll('.park3d-tag, .park3d-zone');
    if (!tags.length) { host.style.display = 'none'; return; }
    host.style.display = '';

    for (var i = 0; i < tags.length; i++) {
      var el = tags[i];
      var wx = parseFloat(el.getAttribute('data-wx'));
      var wy = parseFloat(el.getAttribute('data-wy'));
      var wz = parseFloat(el.getAttribute('data-wz'));
      if (isNaN(wx) || isNaN(wy) || isNaN(wz)) { el.style.display = 'none'; continue; }

      /* 【实测法】不用解析公式手算投影 —— 那是重复实现浏览器的透视除法，
         极易与实际渲染产生几十像素偏差（实测标签跑到画布左上角）。
         改为：在 3D 场景里放一个零尺寸的「探针」元素，坐标与标签一致，
         用 getBoundingClientRect() 读浏览器自己算出的屏幕位置，
         再把屏幕空间的标签贴到该位置。
         好处：透视、perspective-origin、场景旋转、未来的变换改动全部自动一致。 */
      var probe = scene.querySelector('[data-probe="' + el.getAttribute('data-i') + '"]');
      if (!probe) { el.style.display = 'none'; continue; }
      var r = probe.getBoundingClientRect();
      var sr = stage ? stage.getBoundingClientRect() : { left: 0, top: 0 };
      var sx = r.left - sr.left;
      var sy = r.top - sr.top;
      /* 探针是零尺寸，其中心即 3D 锚点；换算成标签层内的相对坐标 */
      el.style.display = '';
      el._sx = sx; el._sy = sy;
    }

    /* 标签避让：密集布局下多个货架标签会重叠成一片（实测 SH-01-01~14 糊在一起）。

       【为什么不能只用中心点间距判断】
       标签是有宽高的矩形（实测 54×26 到 130×26），且横向可排 3~4 个。
       早先的写法按「中心点 |Δx|<80 且 |Δy|<20」判定冲突，判据与实际矩形不符：
         · MIN_GAP=20 < 标签高 26 → 判为不重叠时实际已叠上；
         · 横向阈值固定 80px，遇到「分区标牌(宽 130)+ 仓库名(宽 90)」仍会漏判；
         · 位移超过 60px 就整体放弃避让 → 密集区直接退回重叠状态。
       实测三视角下重叠对数 14~15，正是这三处判据失效导致的。

       【改为矩形级避让】
       以标签真实 offsetWidth/offsetHeight 参与碰撞检测，
       沿 Y 轴按「下、上」交替生成候选位（先下后上，保持视觉上就近），
       取第一个与已放置集合完全不相交的候选；都不行时取重叠面积最小的。
       最后统一把标签夹回舞台内，避免贴边时被裁切。 */
    var ordered = [];
    for (var k = 0; k < tags.length; k++) {
      if (tags[k].style.display === 'none') continue;
      var pr = tags[k].className;
      /* 优先级：层名 > 选中货架 > 分区标牌 > 其余货架。
         高优先级先占位，低优先级的绕开它。 */
      var pri = /level/.test(pr) ? 0 : (/\bactive\b/.test(pr) ? 1 : (/zone/.test(pr) ? 2 : 3));
      ordered.push({
        el: tags[k], x: tags[k]._sx, y: tags[k]._sy, pri: pri,
        w: tags[k].offsetWidth, h: tags[k].offsetHeight
      });
    }
    ordered.sort(function (a, b) { return a.pri - b.pri || a.y - b.y || a.x - b.x; });

    var sr2 = stage ? stage.getBoundingClientRect() : { width: 0, height: 0 };
    var SW = sr2.width, SH = sr2.height;
    var PAD = 4;                       /* 贴边留白，避免被舞台 overflow 裁掉 */
    var STEP_BASE = 4;                 /* 候选位之间的基础步长 */
    /* 位移上限：超过就改为隐藏该标签。
       【为什么要有上限】斜视角下相邻货架在屏幕上的锚点间距会压缩到 30~40px，
       而货架标签本身宽 80px —— 此时"不重叠"在几何上就不可能 achieved，
       强行避让会把标签推到 90~180px 外，标签与货架彻底脱节，
       反而比遮挡更糟（实测 G04/G06 被推开 90px 互相换位，看起来像串号）。
       正确做法是「拥挤时收敛标签」：保留层名、选中货架与分区标牌，
       优先隐藏普通的货架编号；用户悬停/选中某个货架时该标签仍会显示。 */
    var MAX_SHIFT = 56;
    var placed = [];

    /* 候选位与已放置集合的总重叠面积：0 表示完全脱开。
       矩形相交判定：两矩形中心距在 X/Y 上都小于半宽和的一半时相交。 */
    function overlapArea(box) {
      var sum = 0;
      for (var i = 0; i < placed.length; i++) {
        var p = placed[i];
        var ox = (box.w + p.w) / 2 - Math.abs(box.x - p.x);
        var oy = (box.h + p.h) / 2 - Math.abs(box.y - p.y);
        if (ox > 0 && oy > 0) sum += ox * oy;
      }
      return sum;
    }

    /* 拥挤时被隐藏的标签不进入 placed —— 否则它虽然不显示，
       却仍然占位，把后面的标签继续挤走（雪崩式失效）。 */

    for (var m = 0; m < ordered.length; m++) {
      var it = ordered[m];
      var gapY = STEP_BASE + it.h;
      var gapX = STEP_BASE + it.w;
      /* 候选位用「螺旋」生成而非纯竖排：先原位，然后 下/上/右/左/下下/上上/右右/左左 …
         允许横向微调后，密集的一列会自然摊成两列三列，
         位移比纯竖排小得多（实测纯竖排最坏 186px，螺旋 90px）。 */
      var cands = [{ dx: 0, dy: 0 }];
      for (var ring = 1; ring <= 2; ring++) {
        cands.push({ dx: 0, dy: ring * gapY });            /* 下 */
        cands.push({ dx: 0, dy: -ring * gapY });           /* 上 */
        cands.push({ dx: ring * gapX, dy: 0 });            /* 右 */
        cands.push({ dx: -ring * gapX, dy: 0 });           /* 左 */
        cands.push({ dx: ring * gapX, dy: ring * gapY });
        cands.push({ dx: -ring * gapX, dy: ring * gapY });
        cands.push({ dx: ring * gapX, dy: -ring * gapY });
        cands.push({ dx: -ring * gapX, dy: -ring * gapY });
      }
      var best = null, bestArea = Infinity, bestShift = Infinity, bestClean = false;
      for (var s = 0; s < cands.length; s++) {
        var box = { x: it.x + cands[s].dx, y: it.y + cands[s].dy, w: it.w, h: it.h };
        /* 夹回舞台内（先夹再判重叠，否则贴边标签会误判为冲突） */
        box.x = Math.max(PAD + box.w / 2, Math.min(SW - PAD - box.w / 2, box.x));
        box.y = Math.max(PAD + box.h / 2, Math.min(SH - PAD - box.h / 2, box.y));
        var a = overlapArea(box);
        var shift = Math.hypot(box.x - it.x, box.y - it.y);
        if (a === 0) { best = box; bestShift = shift; bestClean = true; break; }
        if (a < bestArea - 1 || (a < bestArea + 1 && shift < bestShift)) {
          bestArea = Math.min(bestArea, a); best = box; bestShift = shift;
        }
      }
      /* 位移过大或仍有明显重叠 → 隐藏该标签（低优先级的先让位）。
         判「是否重叠」必须用 bestClean（本次选中的候选是否零重叠），
         不能用 bestArea —— 早先在找到零重叠候选后 break 时，
         bestArea 仍残留着前面候选的旧值，导致明明有空位却被误隐藏
         （实测默认视角下 21 个标签被隐藏掉 19 个）。 */
      var tooFar = !best || bestShift > MAX_SHIFT || (!bestClean && it.pri >= 2);
      if (tooFar && it.pri >= 2) {
        it.el.style.display = 'none';
        it.el._shift = 0;
        continue;                       /* 不入 placed，避免占位引发雪崩 */
      }
      if (tooFar && it.pri < 2) { best = best || { x: it.x, y: it.y, w: it.w, h: it.h }; bestShift = 0; }
      placed.push(best);
      it.el._shift = Math.round(bestShift);
      it.el._lx = best.x; it.el._ly = best.y;
      it.el.style.transform = 'translate(-50%, -50%) translate(' + Math.round(best.x) + 'px,' + Math.round(best.y) + 'px)';
    }

    /* 位移后补画「标签 → 锚点」的连线：标签被推开多远，就画多长的线，
       让用户仍能确认这个标签说的是哪个货架/哪一层。 */
    var links = host.querySelectorAll('.park-label-link');
    for (var q = 0; q < links.length; q++) {
      var tg = host.querySelector('[data-i="' + links[q].getAttribute('data-link') + '"]');
      if (!tg || tg.style.display === 'none' || typeof tg._sx !== 'number') {
        links[q].style.display = 'none';
        continue;
      }
      var ax = tg._sx, ay = tg._sy;
      var lx = tg._lx, ly = tg._ly;                 /* 标签最终落点（translate 后的坐标） */
      if (typeof lx !== 'number') { links[q].style.display = 'none'; continue; }
      var vx = lx - ax, vy = ly - ay;
      var len = Math.sqrt(vx * vx + vy * vy);
      if (len < 6) { links[q].style.display = 'none'; continue; }
      links[q].style.display = '';
      links[q].style.width = Math.round(len) + 'px';
      links[q].style.transform = 'translate(' + Math.round(ax) + 'px,' + Math.round(ay) + 'px) rotate(' +
        (Math.atan2(vy, vx) * 180 / Math.PI).toFixed(2) + 'deg)';
    }
  }
  /* 原生 CSS 3D 路径的取景参数是否已按当前园区/舞台算过 */
  var cssCamFitted = false;

  /* 降级路径的精确取景：先按估算比例摆一帧，再实测园区在屏幕上的真实包围盒，
     然后用「实测尺寸 + 实测偏差」反推修正量。之所以要实测：
     CSS 3D 的 rotateX + translateZ 抬升 + scale 组合后，解析式推算误差很大
     （实测园区会偏离预估位置近 200px，表现为"园区偏在一角、上方大片空白"）。
     实测法不依赖任何数学假设，对任意行列配置都成立。 */
  function fitCssScene() {
    if (!scene) return;
    var stageEl = $('parkStage');
    if (!stageEl) return;
    var stR = stageEl.getBoundingClientRect();
    if (!stR.width || !stR.height) return;

    /* 第一帧：按园区像素占位粗估一个比例 */
    var lay = LAYOUTS[curWh];
    if (!lay || !lay.racks || !lay.racks.length) return;
    var u = RACK_GAP.x / PARK_GRID.colGap;
    var minX = Infinity, maxX = -Infinity, maxZ = 0;
    lay.zones.forEach(function (z) {
      if (typeof z.originX !== 'number') return;
      minX = Math.min(minX, z.originX);
      maxX = Math.max(maxX, z.originX + z.spanX);
      maxZ = Math.max(maxZ, z.originZ + z.spanZ);
    });
    if (!isFinite(minX) || maxX <= minX) return;
    var parkW = Math.max(1, (maxX - minX) * u + RACK_W);
    var parkD = Math.max(1, maxZ * u + RACK_D);
    /* 俯角用统一常量（48°），与拖动旋转的初始值一致；rz 归零让园区正对观众 */
    cam.rx = CAM_RX; cam.rz = 0;
    cam.scale = Math.max(0.2, Math.min(1.2, stR.width / (parkW * 2.2)));
    cam.ox = 0; cam.oy = 0;
    applyCam();

    /* 第二帧：实测园区包围盒。
       探针含「标签探针」(.park-label-probe) —— 它位于货架顶板上方，是整架最高点。
       注意零尺寸元素：r.right === r.left，直接用 max() 不会扩展边界，
       必须把 left 当作 x2 候选、top 当作 y2 候选一并比较。
       仍需含外围建筑 .park-bldg —— 主建筑贴在园区左侧外围，不计入会被裁掉。 */
    function boundsOf(list) {
      var b = { x1: Infinity, x2: -Infinity, y1: Infinity, y2: -Infinity };
      for (var i = 0; i < list.length; i++) {
        var r = list[i].getBoundingClientRect();
        if (!isFinite(r.left) || r.left === 0) continue;
        if (r.width === 0 && r.height === 0) {
          /* 零尺寸探针：其所在点即 3D 锚点，四个方向都要参与比较 */
          b.x1 = Math.min(b.x1, r.left); b.x2 = Math.max(b.x2, r.left);
          b.y1 = Math.min(b.y1, r.top);  b.y2 = Math.max(b.y2, r.top);
          continue;
        }
        if (r.width <= 0 || r.height <= 0) continue;
        b.x1 = Math.min(b.x1, r.left); b.x2 = Math.max(b.x2, r.right);
        b.y1 = Math.min(b.y1, r.top);  b.y2 = Math.max(b.y2, r.bottom);
      }
      return isFinite(b.x1) && b.x2 > b.x1 ? b : null;
    }
    var measureSel = '.park-rack-level, .park-rack-top, .park-bldg, .park-label-probe';
    var b1 = boundsOf(scene.querySelectorAll(measureSel));
    if (!b1) return;
    var curW = b1.x2 - b1.x1, curH = b1.y2 - b1.y1;
    /* 缩放到刚好装下：宽高两个约束取较小者。
       留 4% 余量即可 —— 标签探针位于顶板上方 16px，若给太大余量
       会让园区被压得很小（实测占比掉到 0.29），实测 0.96~0.98 最合适。 */
    var target = Math.min((stR.width * 0.96) / curW, (stR.height * 0.9) / curH);
    cam.scale = Math.max(0.2, Math.min(2.4, cam.scale * target));
    applyCam();

    /* 第三帧：用最终 scale 再测一次，精确求居中偏移 */
    var b2 = boundsOf(scene.querySelectorAll(measureSel));
    if (!b2) return;
    /* 屏幕中心偏差 → 抵消它（translate 在 scale 之后，需除以 scale 才是场景内位移） */
    var offX = ((b2.x1 + b2.x2) / 2) - (stR.left + stR.width / 2);
    var offY = ((b2.y1 + b2.y2) / 2) - (stR.top + stR.height / 2);
    cam.ox = (cam.ox || 0) - offX / cam.scale;
    cam.oy = (cam.oy || 0) - offY / cam.scale;
    applyCam();
  }

  /* 视角操作统一入口：R3F 走相机预设，原生 CSS 3D 走实测取景。
     用户诉求「无法滑动查看全局」的兜底 —— 任何时候一键都能框住整个园区。 */
  function doFitView() {
    if (r3fReady && parkApp && parkApp.setView) {
      parkApp.setView('fit');
      var hint = $('parkNavHint');
      if (hint) hint.classList.remove('show');
      return;
    }
    /* 原生 CSS 3D：用实测法把园区精确装进并居中于舞台 */
    fitCssScene();
  }

  /* ---------- 交互模式（拖动=旋转 / 拖动=平移） ----------
     缩放与拖拽不冲突的实现要点：
     · 滚轮缩放走 wheel 事件，拖拽走 pointerdrag 事件，两条通道互不干扰；
     · 切换的只是「拖动映射到哪个动作」，不影响滚轮 —— 所以任意模式下都能缩放；
     · 用 three 的数字常量写键位（字符串会静默失效，见 app.park3d.js 注释）。 */
  var navMode = 'rotate';
  function applyNavModeUI() {
    var btn = $('parkBtnMode');
    var txt = $('parkBtnModeTxt');
    var hud = $('parkHudHint');
    var st = $('parkStage');
    var isPan = navMode === 'pan';
    if (btn) btn.setAttribute('aria-pressed', isPan ? 'true' : 'false');
    if (txt) txt.textContent = isPan ? '平移' : '旋转';
    if (st) st.classList.toggle('mode-pan', isPan);
    if (hud) {
      hud.textContent = isPan
        ? '按住左键拖动：上/下/左/右平移园区 · 滚轮缩放 · 点层选中单层 / 点货架选中整架'
        : '按住左键拖动：旋转视角 · 滚轮缩放 · 点层选中单层 / 点货架选中整架';
    }
  }
  function toggleNavMode() {
    navMode = (navMode === 'pan') ? 'rotate' : 'pan';
    if (r3fReady && parkApp && parkApp.setNavMode) parkApp.setNavMode(navMode);
    applyNavModeUI();
    toast(navMode === 'pan' ? '已切换为平移模式：按住拖动可四向查看园区' : '已切换为旋转模式：按住拖动旋转视角', 'success');
  }

  /* 右栏折叠：让 3D 园区占满整行宽度。折叠改变画布尺寸，
     必须重取景，否则用户会看到"画布变大了但园区还是那么小"。 */
  var panelCollapsed = false;
  function togglePanel() {
    panelCollapsed = !panelCollapsed;
    var wrap = $('parkStageWrap');
    if (wrap) wrap.classList.toggle('collapsed', panelCollapsed);
    var btn = $('parkBtnPanel');
    var txt = $('parkBtnPanelTxt');
    if (btn) btn.setAttribute('aria-pressed', panelCollapsed ? 'true' : 'false');
    if (txt) txt.textContent = panelCollapsed ? '展开面板' : '收起面板';
    /* 等 CSS transition 走完再重取景（240ms） */
    setTimeout(function () {
      if (r3fReady && parkApp && parkApp.refit) parkApp.refit();
      else { cssCamFitted = false; doFitView(); }
      renderPark();
    }, 280);
  }

  /* 画布尺寸变化（窗口缩放 / 折叠 / 布局变化）后自适应重取景。
     ResizeObserver 比 window.resize 更准：后者不触发容器自身的尺寸变化。 */
  var parkResizeObserver = null;
  function watchStageResize() {
    var st = $('parkStage');
    if (!st || parkResizeObserver) return;
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', function () {
        if (r3fReady && parkApp && parkApp.refit) parkApp.refit();
      });
      return;
    }
    parkResizeObserver = new ResizeObserver(debounce(function () {
      if (r3fReady && parkApp && parkApp.refit) parkApp.refit();
      else { cssCamFitted = false; doFitView(); }
    }, 220));
    parkResizeObserver.observe(st);
  }
  function debounce(fn, ms) {
    var t = null;
    return function () {
      var self = this, args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, ms);
    };
  }

  /* 原生 CSS 3D 的舞台事件句柄：R3F 接管后必须解绑。
     关键坑：原生 pointerdown 里调了 stage.setPointerCapture()，
     它会把后续 pointermove/pointerup 全部改派给 stage，
     R3F canvas 永远收不到 pointerup → onClick 判定为拖拽而丢弃，
     表现为「点货架没反应」。同时 stage 的 click 取消选中也会误清 R3F 选中的货架。 */
  var parkCtlHandlers = [];
  function bindParkControls() {
    if (parkCtlHandlers.length) return;   /* 只绑一次 */
    function on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      parkCtlHandlers.push([target, type, fn, opts]);
    }
    var dragging = false, lastX = 0, lastY = 0, moved = 0;
    on(stage, 'pointerdown', function (e) {
      dragging = true; moved = 0;
      lastX = e.clientX; lastY = e.clientY;
      stage.classList.add('dragging');
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    on(stage, 'pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX; lastY = e.clientY;
      if (navMode === 'pan') {
        /* 平移模式：拖动直接移动场景偏移（ox/oy），四向自由查看。
           缩放仍由滚轮单独控制（见下方 wheel），与拖拽互不干扰。 */
        cam.ox += dx;
        cam.oy += dy;
      } else {
        /* 旋转模式：绕轴旋转 */
        cam.rz += dx * 0.4;
        cam.rx = Math.max(16, Math.min(78, cam.rx - dy * 0.3));
      }
      if (autoRotate) toggleAutoRotate(false);
      applyCam();
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('dragging');
      try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
      /* 轻点清空选中交由货位/舞台自身的 click 处理，此处只负责停止拖拽状态 */
    }
    on(stage, 'pointerup', endDrag);
    /* 点击舞台空白处取消选中；moved 阈值确保拖拽旋转后不会误清 */
    on(stage, 'click', function (e) {
      if (moved >= 4) return;
      if (e.target.closest('.park-rack-level')) return;
      if (selectedRack) { selectedRack = null; renderPark(); renderPanelEmpty(); }
    });
    on(stage, 'pointercancel', endDrag);

    on(stage, 'wheel', function (e) {
      e.preventDefault();
      var d = e.deltaY > 0 ? -0.08 : 0.08;
      cam.scale = Math.max(0.55, Math.min(1.6, cam.scale + d));
      applyCam();
    }, { passive: false });

    /* 工具栏按钮改由 bindParkToolbar 统一绑定（R3F / CSS 共用，避免 R3F 先就绪时点不动） */
    applyNavModeUI();
    watchStageResize();
  }

  /* 园区工具栏：与 CSS/R3F 渲染路径解耦，enterPark 时必定绑定一次 */
  var parkToolbarBound = false;
  function bindParkToolbar() {
    if (parkToolbarBound) return;
    parkToolbarBound = true;
    var rotBtn = $('parkBtnRotate');
    if (rotBtn) rotBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleAutoRotate(!autoRotate);
    });
    var fitBtn = $('parkBtnFit');
    if (fitBtn) fitBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      doFitView();
    });
    var fitBtn2 = $('parkBtnFit2');
    if (fitBtn2) fitBtn2.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      doFitView();
    });
    var modeBtn = $('parkBtnMode');
    if (modeBtn) modeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleNavMode();
    });
    var panelBtn = $('parkBtnPanel');
    if (panelBtn) panelBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });
    var cfgBtn = $('parkBtnConfig');
    if (cfgBtn) cfgBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openWhConfig();
    });
    var topBtn = $('parkBtnTop');
    if (topBtn) topBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (r3fReady && parkApp && parkApp.setView) { parkApp.setView('top'); return; }
      cam.rx = 74; cam.rz = 0;
      applyCam();
    });
    applyNavModeUI();
  }

  function toggleAutoRotate(on) {
    autoRotate = on;
    var b = $('parkBtnRotate');
    if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
    /* R3F 模式：autoRotate 是 React prop，需重渲一次让 OrbitControls 生效 */
    if (r3fReady && parkApp) { renderPark(); return; }
    if (scene) {
      if (on) { scene.style.transition = 'transform 0.6s cubic-bezier(0.16,1,0.3,1)'; startSpin(); }
      else { scene.style.transition = 'transform 0.6s cubic-bezier(0.16,1,0.3,1)'; stopSpin(); }
    }
  }
  var spinTimer = null;
  function startSpin() {
    stopSpin();
    spinTimer = setInterval(function () {
      if (!autoRotate || !scene) return;
      cam.rz += 0.12;
      scene.style.transition = 'none';
      applyCam();
    }, 32);
  }
  function stopSpin() { if (spinTimer) { clearInterval(spinTimer); spinTimer = null; } }


  /* ---------- 仓库设置面板（名称 / 布局自定义） ---------- */
  function openWhConfig() {
    var cfg = loadWhCfg();
    var html =
      '<div class="wh-cfg">' +
        '<div class="wh-cfg-bar">' +
          '<div class="wh-cfg-bar-label">仓库列表</div>' +
          '<div class="wh-cfg-bar-actions">' +
            '<button type="button" class="wh-cfg-ico" id="whCfgAdd" title="新增仓库" aria-label="新增仓库"><iconify-icon icon="ant-design:plus-outlined" width="15" height="15"></iconify-icon></button>' +
            '<button type="button" class="wh-cfg-ico danger" id="whCfgDel" title="删除当前仓库" aria-label="删除当前仓库"><iconify-icon icon="ant-design:delete-outlined" width="15" height="15"></iconify-icon></button>' +
          '</div>' +
        '</div>' +
        '<div class="wh-cfg-tabs" id="whCfgTabs"></div>' +
        '<div class="wh-cfg-body" id="whCfgBody"></div>' +
        '<div class="wh-cfg-foot">' +
          '<div style="flex:1"></div>' +
          '<button type="button" class="btn btn-outline btn-sm" id="whCfgCancel">取消</button>' +
          '<button type="button" class="btn btn-primary btn-sm" id="whCfgSave"><iconify-icon icon="ant-design:check-outlined" width="14" height="14"></iconify-icon>保存</button>' +
        '</div>' +
      '</div>';
    showModal(html, 'alert', null, 'form');
    /* form 变体：760px 表单宽度 —— 比默认 400px 宽，仓库列表标签与分区参数行
       都能单行排下；又比 wide(1040px) 紧凑，避免字段被拉得过散。 */
    var editIdx = 0;
    var draft = JSON.parse(JSON.stringify(cfg));

    function renderTabs() {
      var box = $('whCfgTabs');
      box.innerHTML = draft.map(function (w, i) {
        return '<button type="button" class="wh-cfg-tab' + (i === editIdx ? ' active' : '') + '" data-i="' + i + '">' +
          escapeHtml(w.name || ('仓库 ' + (i + 1))) + '<span class="wh-cfg-tab-code">' + escapeHtml(w.code || '') + '</span></button>';
      }).join('');
      box.querySelectorAll('.wh-cfg-tab[data-i]').forEach(function (b) {
        b.addEventListener('click', function () { editIdx = parseInt(b.getAttribute('data-i'), 10); renderAll(); });
      });
      /* 操作按钮在栏内常驻（不随 Tab 重绘），事件只绑一次 —— 之前按钮混在
         Tab 列表里每次 innerHTML 重绘都重新绑定，容易出现点击丢失。 */
      var del = $('whCfgDel');
      if (del) {
        del.disabled = draft.length <= 1;
        del.title = draft.length <= 1 ? '至少保留一个仓库' : '删除当前仓库';
      }
    }

    /* 新增 / 删除：只在弹窗打开时绑定一次。
       放在 renderTabs 里会随每次 renderAll 叠加监听器，一次点击触发多次回调。 */
    function bindActions() {
      var add = $('whCfgAdd');
      if (add) add.addEventListener('click', function () {
        /* 编号取现有最大值 +1，避免与已有仓库 id 冲突 */
        var maxN = draft.reduce(function (m, w) {
          var mm = /-(\d+)\$/.exec(w.code || '');
          return mm ? Math.max(m, parseInt(mm[1], 10)) : m;
        }, 0);
        var n = maxN + 1;
        draft.push({
          id: 'WH-N' + n, code: 'WH-' + String(n).padStart(2, '0'), name: '新仓库 ' + n,
          area: '1,000 m²', city: '待填写',
          zones: [
            { key: 'gift', name: '礼品区', isGift: true, cols: 2, rows: 1, levels: 4 },
            { key: 'cargo', name: '货物区', isGift: false, cols: 2, rows: 1, levels: 4 }
          ]
        });
        editIdx = draft.length - 1;
        renderAll();
        toast('已新增仓库，填写名称后保存生效', 'success');
      });
      var del = $('whCfgDel');
      if (del) del.addEventListener('click', function () {
        if (draft.length <= 1) { toast('至少保留一个仓库', 'warning'); return; }
        var w = draft[editIdx];
        if (!w) return;
        showModal('确定删除仓库「' + (w.name || '') + '」？其分区、货架与自定义编号将一并移除。', 'confirm', function (ok) {
          if (!ok) return;
          draft.splice(editIdx, 1);
          editIdx = Math.min(editIdx, draft.length - 1);
          if (editIdx < 0) editIdx = 0;
          renderAll();
          toast('已删除仓库（保存后生效）', 'success');
        });
      });
    }

    function renderBody() {
      var w = draft[editIdx];
      if (!w) { $('whCfgBody').innerHTML = '<div class="alert-empty">请先新增一个仓库</div>'; return; }
      var zoneHtml = '';
      w.zones.forEach(function (z, zi) {
        /* 建筑构件（入口门 / 主通道 / 隔墙）不属于可编辑货架分区，面板不渲染、保存时原样保留 */
        if (z.kind) return;
        zoneHtml +=
          '<div class="wh-zone-row" data-z="' + zi + '">' +
            '<div class="wh-zone-head">' +
              '<span class="wh-zone-idx">' + (zi + 1) + '</span>' +
              '<input type="text" class="wh-inp wh-zone-name" value="' + escapeAttr(z.name) + '" maxlength="16" placeholder="分区名称" />' +
              '<label class="wh-chk"><input type="checkbox" class="wh-zone-gift"' + (z.isGift ? ' checked' : '') + ' /> 礼品区</label>' +
              '<button type="button" class="wh-zone-del" title="删除该分区" aria-label="删除该分区"><iconify-icon icon="ant-design:delete-outlined" width="14" height="14"></iconify-icon></button>' +
            '</div>' +
            '<div class="wh-zone-params">' +
              '<label class="wh-lbl">列数<span class="wh-bubble-mount" data-k="cols"></span></label>' +
              '<label class="wh-lbl">行数<span class="wh-bubble-mount" data-k="rows"></span></label>' +
              '<label class="wh-lbl">层数<span class="wh-bubble-mount" data-k="levels"></span></label>' +
              '<div class="wh-zone-sum">' + (z.cols * z.rows) + ' 货架 · ' + (z.cols * z.rows * z.levels) + ' 货位</div>' +
            '</div>' +
          '</div>';
      });

      /* 货架统计只计可编辑分区（建筑构件不生成货架） */
      var editableZones = w.zones.filter(function (z) { return !z.kind; });
      var rackCount = editableZones.reduce(function (s, z) { return s + z.cols * z.rows; }, 0);
      var levelTotal = editableZones.reduce(function (s, z) { return s + z.cols * z.rows * z.levels; }, 0);

      $('whCfgBody').innerHTML =
        '<div class="wh-cfg-grid">' +
          '<label class="wh-field"><span>仓库名称</span><input type="text" class="wh-inp" id="whCfgName" value="' + escapeAttr(w.name) + '" maxlength="20" placeholder="例如：华东中心仓" /></label>' +
          '<label class="wh-field"><span>仓库编号</span><input type="text" class="wh-inp" id="whCfgCode" value="' + escapeAttr(w.code) + '" maxlength="12" placeholder="SH-01" /></label>' +
          '<label class="wh-field"><span>面积</span><input type="text" class="wh-inp" id="whCfgArea" value="' + escapeAttr(w.area) + '" maxlength="20" placeholder="4,200 m²" /></label>' +
          '<label class="wh-field"><span>所在地</span><input type="text" class="wh-inp" id="whCfgCity" value="' + escapeAttr(w.city) + '" maxlength="30" placeholder="上海 · 嘉定" /></label>' +
        '</div>' +
        '<div class="wh-cfg-sub">' +
          '<span>分区与货架布局</span>' +
          '<button type="button" class="btn btn-outline btn-sm" id="whCfgAddZone"><iconify-icon icon="ant-design:plus-outlined" width="13" height="13"></iconify-icon>添加分区</button>' +
        '</div>' +
        '<div class="wh-zone-list">' + (zoneHtml || '<div class="alert-empty">暂无分区，点击「添加分区」开始规划</div>') + '</div>' +
        '<div class="wh-cfg-hint">当前布局：<b>' + editableZones.length + '</b> 个分区 · <b>' + rackCount + '</b> 个货架 · <b>' + levelTotal + '</b> 个货位</div>';

      /* 列数 / 行数 / 层数统一走全局气泡弹窗组件（与分页器、对比选择同一实现） */
      if (window.createBubble) {
        var ZONE_OPTS = { cols: [1, 2, 3, 4, 5, 6], rows: [1, 2, 3, 4], levels: [1, 2, 3, 4, 5, 6] };
        $('whCfgBody').querySelectorAll('.wh-bubble-mount').forEach(function (m) {
          var row = m.closest('.wh-zone-row');
          if (!row) return;
          var zi = parseInt(row.getAttribute('data-z'), 10);
          var k = m.getAttribute('data-k');
          window.createBubble(m, {
            value: String(w.zones[zi][k]),
            options: ZONE_OPTS[k].map(function (n) { return { value: String(n), label: String(n) }; }),
            onChange: function (v) {
              w.zones[zi][k] = parseInt(v, 10);
              renderBody();
            }
          });
        });
      }

      /* 字段双向绑定 */
      function bindField(id, key) {
        var el = $(id);
        if (el) el.addEventListener('input', function () { w[key] = this.value; });
      }
      bindField('whCfgName', 'name');
      bindField('whCfgCode', 'code');
      bindField('whCfgArea', 'area');
      bindField('whCfgCity', 'city');

      /* 分区行绑定 */
      $('whCfgBody').querySelectorAll('.wh-zone-row').forEach(function (row) {
        var zi = parseInt(row.getAttribute('data-z'), 10);
        var z = w.zones[zi];
        row.querySelector('.wh-zone-name').addEventListener('input', function () { z.name = this.value; renderTabs(); });
        row.querySelector('.wh-zone-gift').addEventListener('change', function () { z.isGift = this.checked; });
        row.querySelector('.wh-zone-del').addEventListener('click', function () {
          if (w.zones.filter(function (z) { return !z.kind; }).length <= 1) { toast('至少保留一个分区', 'warning'); return; }
          w.zones.splice(zi, 1);
          renderAll();
        });
      });

      var addZone = $('whCfgAddZone');
      if (addZone) addZone.addEventListener('click', function () {
        if (w.zones.filter(function (z) { return !z.kind; }).length >= 6) { toast('最多 6 个分区', 'warning'); return; }
        w.zones.push({ key: 'zone' + w.zones.length, name: '新分区', isGift: false, cols: 2, rows: 1, levels: 4 });
        renderAll();
      });
    }

    function renderAll() { renderTabs(); renderBody(); }
    bindActions();
    renderAll();

    $('whCfgCancel').addEventListener('click', function () { hideModal(); });
    $('whCfgSave').addEventListener('click', function () {
      var valid = draft.filter(function (w) { return (w.name || '').trim(); });
      if (!valid.length) { toast('请至少保留一个有效仓库', 'warning'); return; }
      saveWhCfg(draft);
      WAREHOUSES = loadWhCfg();
      rebuildLayouts();
      applyRackCustom(); /* 仓库变更后重新覆盖货架自定义 */
      rebuildFlows();
      /* 当前仓库可能已被删除，兜底切到第一个 */
      if (!WAREHOUSES.some(function (w) { return w.id === curWh; })) curWh = WAREHOUSES[0].id;
      selectedRack = null;
      renderWhSwitch();
      renderPark();
      renderPanelEmpty();
      renderStockKpis();
      updateAlertBadge();
      hideModal();
      toast('仓库配置已应用', 'success');
    });
  }

  /* ---------- React 3D 园区桥接 ----------
     渲染交给 React Three Fiber（WebGL），业务数据仍由本模块提供。
     parkApp 持有 R3F 挂载句柄；未就绪时回退到原生 CSS 3D 渲染。 */
  var parkApp = null, r3fReady = false;
  /* 闪屏修复：r3fMounted 标记避免重复 mount；r3fRafId 防抖合并同帧多次 renderPark；
     r3fOnPick 稳定引用避免每次 render 新建闭包触发 Canvas 内部 effect 重跑 */
  var r3fMounted = false, r3fRafId = null, r3fOnPick = null;

  function mountR3F(warehouseId, layout, selected) {
    /* 必须挂到 #parkCanvas 专用容器，不能用 #parkStage ——
       Park3D.mount() 首次会执行 container.innerHTML = ''，
       直接挂 stage 会把 HUD、操作提示条等兄弟节点全部清掉。 */
    var container = $('parkCanvas') || $('parkStage');
    if (!container || !parkApp) return false;
    /* 已挂载 → 走增量 update，避免重复 mount 清空容器 */
    if (r3fMounted) return updateR3F(warehouseId, layout, selected);
    /* 稳定 onPick：读模块级 curWh 实时值，不固化闭包 */
    if (!r3fOnPick) {
      /* 稳定引用的拾取回调。
         交互要点：命中货架时先暂停自动环绕 —— 自动旋转会持续移动相机，
         R3F 的 onClick 依赖 pointerdown/up 期间射线未移动，相机自己在动时
         会被判定为拖拽而吞掉点击，表现为「点货架没反应」。 */
      r3fOnPick = function (rack, level) {
        if (!rack) { selectedRack = null; renderPanelEmpty(); renderPark(); return; }
        if (autoRotate) toggleAutoRotate(false);
        openRack(curWh, rack.id, level);
      };
    }
    try {
      parkApp.mount(container, {
        layout: layout,
        selectedId: selected ? selected.id : null,
        selectedLevel: selected ? selected.level : null,
        autoRotate: autoRotate,
        tx: 0, tz: 0,
        onPick: r3fOnPick
      });
      r3fMounted = true;
      return true;
    } catch (err) {
      return false;
    }
  }

  function updateR3F(warehouseId, layout, selected) {
    if (!parkApp) return false;
    if (!r3fOnPick) {
      /* 稳定引用的拾取回调。
         交互要点：命中货架时先暂停自动环绕 —— 自动旋转会持续移动相机，
         R3F 的 onClick 依赖 pointerdown/up 期间射线未移动，相机自己在动时
         会被判定为拖拽而吞掉点击，表现为「点货架没反应」。 */
      r3fOnPick = function (rack, level) {
        if (!rack) { selectedRack = null; renderPanelEmpty(); renderPark(); return; }
        if (autoRotate) toggleAutoRotate(false);
        openRack(curWh, rack.id, level);
      };
    }
    try {
      parkApp.update({
        layout: layout,
        selectedId: selected ? selected.id : null,
        selectedLevel: selected ? selected.level : null,
        autoRotate: autoRotate,
        tx: 0, tz: 0,
        onPick: r3fOnPick
      });
      return true;
    } catch (err) { return false; }
  }

  /* R3F 模式下的舞台交互反馈：
     ① 拖拽时给出 grabbing 光标（原生 CSS 3D 路径的 dragging 类已被解绑）；
     ② 相机滑离园区时显示常驻操作条 + 「回到全园」，解决"滑出去就找不回全局"。
     注意：这里只监听、不调 setPointerCapture —— 那个调用会劫持 canvas 的
     pointerup 导致 R3F onClick 失效（见 unbindParkControls 注释）。 */
  function bindR3FStageHints(stageEl) {
    if (!stageEl || stageEl.__r3fHints) return;
    stageEl.__r3fHints = true;
    var hint = $('parkNavHint');
    var hintTxt = $('parkNavHintTxt');
    var dragging = false, checkTimer = null;
    function refreshHint() {
      var off = false;
      try { off = !!(parkApp && parkApp.isOffPark && parkApp.isOffPark()); } catch (e) {}
      if (hint) hint.classList.toggle('show', off);
      if (hintTxt) {
        hintTxt.textContent = off
          ? '已滑出园区范围，点「回到全园」重新框住全部货架'
          : (navMode === 'pan'
            ? '按住左键拖动可四向平移园区，滚轮缩放互不干扰'
            : '切到「平移」后按住左键拖动可四向查看，滚轮仍可缩放');
      }
    }
    stageEl.addEventListener('pointerdown', function (e) {
      if (e.button === 0) { dragging = true; stageEl.classList.add('dragging'); }
      if (autoRotate) toggleAutoRotate(false);
    });
    window.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      stageEl.classList.remove('dragging');
    });
    /* 相机变化由 R3F 内部驱动，宿主用轻量轮询同步提示条（约 4fps，足够且不干扰渲染） */
    checkTimer = setInterval(refreshHint, 260);
    refreshHint();
    /* 切页时停掉轮询，避免空跑 */
    if (!r3fHintTimer) r3fHintTimer = { t: checkTimer, el: stageEl };
  }
  var r3fHintTimer = null;
  function stopR3FStageHints() {
    if (!r3fHintTimer) return;
    try { clearInterval(r3fHintTimer.t); } catch (e) {}
    r3fHintTimer = null;
  }

  /* React 层异步就绪后接管渲染 */
  function unbindParkControls() {
    parkCtlHandlers.forEach(function (h) {
      try { h[0].removeEventListener(h[1], h[2], h[3]); } catch (e) {}
    });
    parkCtlHandlers = [];
    if (stage) stage.classList.remove('dragging');
  }
  /* 等待独立 R3F 模块（park3d-module.js）就绪；模块为 type=module 异步加载 */
  var _r3fWaitTimer = null;
  function initR3F() {
    if (r3fReady) return;
    if (!window.Park3D) {
      if (_r3fWaitTimer) return;
      var tries = 0;
      _r3fWaitTimer = setInterval(function () {
        tries++;
        if (window.Park3D) {
          clearInterval(_r3fWaitTimer); _r3fWaitTimer = null;
          initR3F();
        } else if (tries > 80) {
          clearInterval(_r3fWaitTimer); _r3fWaitTimer = null;
          console.warn('[WH] Park3D 模块加载超时，使用 CSS 3D 降级');
        }
      }, 50);
      return;
    }
    window.Park3D.init().then(function (app) {
      parkApp = app;
      r3fReady = true;
      r3fMounted = false;
      var stageEl = $('parkStage');
      if (stageEl) {
        unbindParkControls();
        var oldScene = stageEl.querySelector('#parkScene');
        if (oldScene && oldScene.parentNode) oldScene.parentNode.removeChild(oldScene);
        var oldLabels = $('parkLabelLayer');
        if (oldLabels) oldLabels.innerHTML = '';
        var holder = document.getElementById('parkCanvas');
        if (!holder) {
          holder = document.createElement('div');
          holder.id = 'parkCanvas';
          holder.style.cssText = 'position:absolute;inset:0;z-index:0;';
          stageEl.insertBefore(holder, stageEl.firstChild);
        }
        scene = null;
        stageEl.classList.add('r3f-active');
        stageEl.setAttribute('data-render', 'r3f');
        var modeTip2 = document.getElementById('parkRenderModeTip');
        if (modeTip2) {
          modeTip2.textContent = 'R3F 3D 已启用';
          modeTip2.style.background = 'rgba(40,120,80,0.88)';
          setTimeout(function () { if (modeTip2.parentNode) modeTip2.parentNode.removeChild(modeTip2); }, 2500);
        }
        if (parkApp.setNavMode) parkApp.setNavMode(navMode);
        applyNavModeUI();
        renderPark();
        setTimeout(function () { if (parkApp.setView) parkApp.setView('reset'); }, 80);
        bindR3FStageHints(stageEl);
        watchStageResize();
      }
    }).catch(function (err) {
      console.warn('[WH] Park3D init failed', err);
      r3fReady = false;
    });
  }

  /* ---------- 详情侧栏 ---------- */
  /* 层选中浮层：展示商品名称与库存，固定屏幕坐标避免 3D 变换导致抖动 */
  function showParkFloat(wh, rack, level) {
    var el = $('parkFloat');
    if (!el) return;
    if (!level) {
      /* 整架选中：汇总各层库存，列出前若干货品 */
      var totalStock = 0, totalCap = 0, goodsMap = {};
      (rack.levels || []).forEach(function (l) {
        totalStock += l.stock || 0;
        totalCap += l.capacity || 0;
        (l.goods || []).forEach(function (g) {
          var k = g.name || '未命名';
          goodsMap[k] = (goodsMap[k] || 0) + (g.qty || 0);
        });
      });
      var goods = Object.keys(goodsMap).map(function (n) { return { name: n, qty: goodsMap[n] }; })
        .sort(function (a, b) { return b.qty - a.qty; }).slice(0, 6);
      var title = escapeHtml(rack.code) + (rack.name ? ' · ' + escapeHtml(rack.name) : '');
      var meta = escapeHtml(wh.name) + ' · 整架 ' + (rack.levels ? rack.levels.length : 0) + ' 层';
      el.innerHTML =
        '<div class="park-float-head">' +
          '<span class="park-float-code">' + title + '</span>' +
          '<span class="park-float-meta">' + meta + '</span>' +
          '<button type="button" class="park-float-close" id="parkFloatClose" title="关闭" aria-label="关闭">' +
            '<iconify-icon icon="ant-design:close-outlined" width="12" height="12"></iconify-icon></button>' +
        '</div>' +
        '<div class="park-float-stock">库存 <b>' + totalStock + '</b> / 容量 ' + totalCap + '</div>' +
        (goods.length
          ? '<div class="park-float-goods">' + goods.map(function (g) {
              return '<div class="park-float-good"><span class="park-float-good-n">' + escapeHtml(g.name) +
                '</span><span class="park-float-good-q">' + g.qty + '</span></div>';
            }).join('') + '</div>'
          : '<div class="park-float-empty">暂无货品，导入库存后自动填充</div>');
    } else {
      var rate = level.capacity ? Math.min(100, Math.round(level.stock / level.capacity * 100)) : 0;
      var lvTitle = '第 ' + level.level + ' 层' + (level.name ? ' · ' + escapeHtml(level.name) : '');
      var goods2 = level.goods || [];
      el.innerHTML =
        '<div class="park-float-head">' +
          '<span class="park-float-code">' + escapeHtml(rack.code) + '</span>' +
          '<span class="park-float-meta">' + lvTitle + '</span>' +
          '<button type="button" class="park-float-close" id="parkFloatClose" title="关闭" aria-label="关闭">' +
            '<iconify-icon icon="ant-design:close-outlined" width="12" height="12"></iconify-icon></button>' +
        '</div>' +
        '<div class="park-float-stock">库存 <b>' + (level.stock || 0) + '</b> / 容量 ' + (level.capacity || 0) +
          '（' + rate + '%）</div>' +
        (goods2.length
          ? '<div class="park-float-goods">' + goods2.map(function (g) {
              return '<div class="park-float-good"><span class="park-float-good-n">' + escapeHtml(g.name) +
                '</span><span class="park-float-good-q">' + g.qty + '</span></div>';
            }).join('') + '</div>'
          : '<div class="park-float-empty">本层暂无货品</div>');
    }
    el.hidden = false;
    var closeBtn = $('parkFloatClose');
    if (closeBtn) closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      hideParkFloat();
      selectedRack = null;
      renderPark();
      renderPanelEmpty();
    });
  }
  function hideParkFloat() {
    var el = $('parkFloat');
    if (el) { el.hidden = true; el.innerHTML = ''; }
  }

  function renderPanelEmpty() {
    hideParkFloat();
    var p = $('parkPanel');
    if (!p) return;
    p.innerHTML =
      '<div class="park-panel-empty">' +
      '<svg class="illus" width="132" height="96" viewBox="0 0 132 96" role="img" aria-label="未选择货架">' +
      '<rect class="il-f" x="28" y="20" width="76" height="56" rx="6"/>' +
      '<rect class="il-a" x="28" y="20" width="76" height="56" rx="6"/>' +
      '<path class="il-b" d="M40 38h52M40 52h52M40 66h34"/></svg>' +
      '<p class="park-panel-title">未选择货架</p>' +
      '<p class="park-panel-sub">在左侧园区中点击任意货架层查看该层商品与库存，点击货架本体查看整架。选中后可在右侧重命名货架或层名称。</p>' +
      '</div>';
  }

  /* 选中态统一结构：{ id, level }，level 为 null 表示整架 */
  function openRack(whId, rackId, levelNo) {
    var wh = WAREHOUSES.filter(function (w) { return w.id === whId; })[0];
    var rack = LAYOUTS[whId].racks.filter(function (r) { return r.id === rackId; })[0];
    if (!rack) return;
    selectedRack = levelNo ? { id: rackId, level: levelNo } : { id: rackId, level: null };
    renderPark();

    var p = $('parkPanel');
    if (!p) return;
    var target = levelNo ? rack.levels.filter(function (l) { return l.level === levelNo; })[0] : null;
    var flows = FLOWS.filter(function (f) {
      return f.whId === whId && f.rackCode === rack.code && (!levelNo || f.level === levelNo);
    }).slice(0, 8);

    /* 层选中浮层：即时展示商品名称与库存数量（不依赖侧栏是否展开） */
    showParkFloat(wh, rack, target);

    /* 头部：整架视角显示「货架」重命名入口；层视角额外显示「本层」重命名入口 */
    var lvName = target ? (target.name || '') : '';
    var html =
      '<div class="park-panel-head">' +
      '<div class="park-panel-head-main">' +
        '<h3>' + escapeHtml(rack.code) + '</h3>' +
        (rack.name ? '<div class="park-panel-name">' + escapeHtml(rack.name) + '</div>' : '') +
      '</div>' +
      '<div class="park-panel-ops">' +
        '<button type="button" class="park-rename-btn" id="parkBtnEditRack" title="重命名货架编号与名称">' +
          '<iconify-icon icon="ant-design:edit-outlined" width="13" height="13"></iconify-icon>重命名货架</button>' +
        (target ? '<button type="button" class="park-rename-btn" id="parkBtnEditLevel" title="重命名当前层">' +
          '<iconify-icon icon="ant-design:edit-outlined" width="13" height="13"></iconify-icon>重命名本层</button>' : '') +
      '</div>' +
      '<div class="park-panel-path">' + escapeHtml(wh.name) + ' · ' + escapeHtml(rack.zoneName) +
      (target ? ' · 第 ' + target.level + ' 层' + (lvName ? ' · ' + escapeHtml(lvName) : '') : ' · 全部 ' + rack.levels.length + ' 层') + '</div>' +
      '</div>';

    if (target) {
      var rate = target.capacity ? Math.min(100, Math.round(target.stock / target.capacity * 100)) : 0;
      var cat = CATEGORIES.filter(function (c) { return c.key === target.cat; })[0];
      html += '<div class="park-sec"><div class="park-sec-title">货位信息</div>' +
        '<div class="park-kv"><span class="park-kv-k">层名称</span><span class="park-kv-v">' +
        (lvName ? escapeHtml(lvName) : '<span class="park-kv-empty">未命名</span>') + '</span></div>' +
        '<div class="park-kv"><span class="park-kv-k">品类</span><span class="park-kv-v">' + escapeHtml(cat ? cat.name : target.cat) + '</span></div>' +
        '<div class="park-kv"><span class="park-kv-k">库存 / 容量</span><span class="park-kv-v">' + target.stock + ' / ' + target.capacity + '（' + rate + '%）</span></div>' +
        '</div>';
      html += '<div class="park-sec"><div class="park-sec-title">货品清单</div><div class="park-goods">';
      if (!target.goods || !target.goods.length) {
        html += '<div class="alert-empty">暂无货品，导入库存数据后自动填充</div>';
      }
      target.goods.forEach(function (g) {
        var isGift = cat && cat.isGift;
        html += '<div class="park-good' + (isGift ? ' gift' : '') + '">' +
          '<iconify-icon icon="ant-design:' + (isGift ? 'gift-outlined' : 'inbox-outlined') + '" width="13" height="13"></iconify-icon>' +
          '<span class="park-good-n">' + escapeHtml(g.name) + '</span>' +
          '<span class="park-good-q">' + g.qty + '</span></div>';
      });
      html += '</div></div>';
    } else {
      html += '<div class="park-sec"><div class="park-sec-title">各层占用<span class="park-sec-tip">点行选中该层，点铅笔重命名</span></div>';
      rack.levels.forEach(function (l) {
        var rate = l.capacity ? Math.min(100, Math.round(l.stock / l.capacity * 100)) : 0;
        var c = CATEGORIES.filter(function (x) { return x.key === l.cat; })[0];
        html += '<div class="park-lv-row" data-lv="' + l.level + '">' +
          '<span class="park-lv-main"><span class="park-lv-no">第 ' + l.level + ' 层</span>' +
          (l.name ? '<span class="park-lv-name">' + escapeHtml(l.name) + '</span>' : '') +
          '<span class="park-lv-cat">' + escapeHtml(c ? c.name : l.cat) + '</span></span>' +
          '<span class="park-lv-v">' + l.stock + ' / ' + l.capacity + '（' + rate + '%）</span>' +
          '<button type="button" class="park-lv-edit" data-lv-edit="' + l.level + '" title="重命名第 ' + l.level + ' 层">' +
            '<iconify-icon icon="ant-design:edit-outlined" width="12" height="12"></iconify-icon></button>' +
          '</div>';
      });
      html += '</div>';
    }

    html += '<div class="park-sec"><div class="park-sec-title">出入库流水 / 人员取货</div>';
    if (!flows.length) {
      html += '<div class="alert-empty">该范围近 7 天暂无出入库记录</div>';
    } else {
      html += '<div class="park-flow">';
      flows.forEach(function (f) {
        var d = new Date(f.time);
        var ts = d.getMonth() + 1 + '/' + d.getDate() + ' ' +
          String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        html += '<div class="park-flow-item">' +
          '<span class="park-flow-dot ' + f.type + '"></span>' +
          '<div class="park-flow-body">' +
          '<div class="park-flow-t">' + (f.type === 'in' ? '入库' : '出库') + ' ' + f.qty + ' 件 · ' + escapeHtml(f.goods) + '</div>' +
          '<div class="park-flow-m">' + ts + ' · 经办 ' + escapeHtml(f.staff) + (f.type === 'out' ? ' · ' + escapeHtml(f.carrier) : '') + '</div>' +
          '</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';
    p.innerHTML = html;
    p.scrollTop = 0;
    /* 绑定重命名入口 */
    var editBtn = $('parkBtnEditRack');
    if (editBtn) editBtn.addEventListener('click', function () {
      openRackCfg(whId, rackId, null);
    });
    var editLvBtn = $('parkBtnEditLevel');
    if (editLvBtn) editLvBtn.addEventListener('click', function () {
      openLevelCfg(whId, rackId, levelNo);
    });
    /* 各层占用：点行 → 进入该层；点铅笔 → 只重命名该层（不切换选中） */
    p.querySelectorAll('.park-lv-row').forEach(function (row) {
      var lv = parseInt(row.getAttribute('data-lv'), 10);
      row.addEventListener('click', function (e) {
        if (e.target.closest('.park-lv-edit')) return;
        openRack(whId, rackId, lv);
      });
      var ed = row.querySelector('.park-lv-edit');
      if (ed) ed.addEventListener('click', function (e) {
        e.stopPropagation();
        openLevelCfg(whId, rackId, lv);
      });
    });
  }

  /* ---------- 层重命名弹窗 ---------- */
  function openLevelCfg(whId, rackId, levelNo) {
    var wh = WAREHOUSES.filter(function (w) { return w.id === whId; })[0];
    var layout = LAYOUTS[whId];
    if (!wh || !layout) return;
    var rack = layout.racks.filter(function (r) { return r.id === rackId; })[0];
    if (!rack) return;
    var lv = rack.levels.filter(function (l) { return l.level === levelNo; })[0];
    if (!lv) return;
    var cfg = loadRackCfg();
    var whCfg = cfg[whId] || {};
    var rc = whCfg[rackId] || {};
    var curName = lv.name || '';

    var html =
      '<div class="wh-cfg">' +
        '<div class="wh-cfg-body" style="padding:22px 24px;">' +
          '<div class="wh-cfg-sub" style="margin-bottom:14px;">层重命名 · ' + escapeHtml(wh.name) + ' · ' + escapeHtml(rack.code) + ' · 第 ' + lv.level + ' 层</div>' +
          '<div class="wh-field"><label class="wh-lbl">层名称（可选）</label>' +
            '<input class="wh-inp" id="lvCfgName" value="' + escapeHtml(curName) + '" maxlength="16" placeholder="如：顶层礼盒 / 底层重货" autocomplete="off">' +
            '<div class="wh-cfg-hint">显示在 3D 场景层标与详情面板，用于区分各层用途</div>' +
          '</div>' +
        '</div>' +
        '<div class="wh-cfg-foot">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="lvCfgReset">清除名称</button>' +
          '<div style="flex:1"></div>' +
          '<button type="button" class="btn btn-outline btn-sm" id="lvCfgCancel">取消</button>' +
          '<button type="button" class="btn btn-primary btn-sm" id="lvCfgSave">保存</button>' +
        '</div>' +
      '</div>';
    showModal(html, 'alert', null, 'form');

    function commit(name) {
      /* 保留该货架已有的 code/name，只更新 levels 映射 */
      whCfg[rackId] = {
        code: rc.code || rack.code,
        name: rc.name || rack.name || '',
        levels: Object.assign({}, rc.levels || {})
      };
      if (name) whCfg[rackId].levels[lv.level] = name;
      else delete whCfg[rackId].levels[lv.level];
      if (!Object.keys(whCfg[rackId].levels).length) delete whCfg[rackId].levels;
      cfg[whId] = whCfg;
      saveRackCfg(cfg);
      applyRackCustom();
      renderPark();
      openRack(whId, rackId, selectedRack && selectedRack.level);
    }

    $('lvCfgCancel').addEventListener('click', function () { hideModal(); });
    $('lvCfgReset').addEventListener('click', function () { commit(''); hideModal(); toast('已清除层名称', 'success'); });
    $('lvCfgSave').addEventListener('click', function () {
      var name = $('lvCfgName').value.trim();
      commit(name);
      hideModal();
      toast(name ? ('第 ' + lv.level + ' 层已重命名为「' + name + '」') : '已清除层名称', 'success');
    });
    /* 回车即保存 */
    $('lvCfgName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') $('lvCfgSave').click();
    });
  }

  /* ---------- 货架自定义弹窗（编号 / 名称） ---------- */
  function openRackCfg(whId, rackId, levelNo) {
    var wh = WAREHOUSES.filter(function (w) { return w.id === whId; })[0];
    var layout = LAYOUTS[whId];
    if (!wh || !layout) return;
    var rack = layout.racks.filter(function (r) { return r.id === rackId; })[0];
    if (!rack) return;
    var cfg = loadRackCfg();
    var whCfg = cfg[whId] || {};
    var cur = whCfg[rackId] || { code: rack.code, name: rack.name || '' };
    var defaultCode = rack.code; /* 当前已应用后的 code（含此前自定义） */
    /* 保留已有层名称：改货架名不应清掉逐层命名 */
    var curLevels = (cur.levels && Object.keys(cur.levels).length) ? cur.levels : null;

    var html =
      '<div class="wh-cfg">' +
        '<div class="wh-cfg-body" style="padding:22px 24px;">' +
          '<div class="wh-cfg-sub" style="margin-bottom:14px;">货架重命名 · ' + escapeHtml(wh.name) + '</div>' +
          '<div class="wh-cfg-grid">' +
            '<div class="wh-field"><label class="wh-lbl">货架编号</label>' +
              '<input class="wh-inp" id="rackCfgCode" value="' + escapeHtml(cur.code) + '" maxlength="12" placeholder="' + escapeHtml(defaultCode) + '" autocomplete="off">' +
              '<div class="wh-cfg-hint">显示在 3D 场景标签与详情面板标题</div>' +
            '</div>' +
            '<div class="wh-field"><label class="wh-lbl">货架名称（可选）</label>' +
              '<input class="wh-inp" id="rackCfgName" value="' + escapeHtml(cur.name) + '" maxlength="20" placeholder="如：A 区主推礼品架" autocomplete="off">' +
              '<div class="wh-cfg-hint">备注用途，便于快速识别货架用途</div>' +
            '</div>' +
          '</div>' +
          '<div class="wh-cfg-hint" style="margin-top:14px;">货架位于：<strong>' + escapeHtml(rack.zoneName) + '</strong> · 列 ' + (rack.col + 1) + ' · 行 ' + (rack.row + 1) + ' · ' + rack.levels.length + ' 层' +
          (curLevels ? '（已命名 ' + Object.keys(curLevels).length + ' 层，保存后保留）' : '') + '</div>' +
        '</div>' +
        '<div class="wh-cfg-foot">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="rackCfgReset">恢复默认</button>' +
          '<div style="flex:1"></div>' +
          '<button type="button" class="btn btn-outline btn-sm" id="rackCfgCancel">取消</button>' +
          '<button type="button" class="btn btn-primary btn-sm" id="rackCfgSave">保存</button>' +
        '</div>' +
      '</div>';
    /* 表单变体：内容自带底部操作区，不渲染默认确认键 */
    showModal(html, 'alert', null, 'form');

    $('rackCfgCancel').addEventListener('click', function () { hideModal(); });
    $('rackCfgReset').addEventListener('click', function () {
      showModal('确定恢复该货架的默认编号？当前自定义将被清除。', 'confirm', function (ok) {
        if (!ok) return;
        delete whCfg[rackId];
        if (Object.keys(whCfg).length) cfg[whId] = whCfg;
        else delete cfg[whId];
        saveRackCfg(cfg);
        applyRackCustom();
        renderPark();
        if (levelNo || levelNo === 0) openRack(whId, rackId, levelNo);
        else openRack(whId, rackId, null);
        hideModal();
        toast('已恢复默认编号', 'success');
      });
    });
    $('rackCfgSave').addEventListener('click', function () {
      var code = $('rackCfgCode').value.trim();
      var name = $('rackCfgName').value.trim();
      if (!code && !name) {
        delete whCfg[rackId];
        if (Object.keys(whCfg).length) cfg[whId] = whCfg;
        else delete cfg[whId];
      } else {
        whCfg[rackId] = { code: code || defaultCode, name: name };
        /* 逐层名称独立保存，不随货架改名丢失 */
        if (curLevels) whCfg[rackId].levels = curLevels;
        cfg[whId] = whCfg;
      }
      saveRackCfg(cfg);
      applyRackCustom();
      renderPark();
      /* 刷新详情面板，保留当前层级选中态 */
      if (levelNo || levelNo === 0) openRack(whId, rackId, levelNo);
      else openRack(whId, rackId, null);
      hideModal();
      toast('货架已重命名', 'success');
    });
    /* 回车即保存 */
    $('rackCfgCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('rackCfgSave').click(); });
    $('rackCfgName').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('rackCfgSave').click(); });
  }

  /* ---------- 库存管理渲染 ---------- */
  var flowPager = null, slowPager = null;
  var flowFilter = 'all', flowKw = '', slowFilter = 'all';
  /* 变更类型多选：空数组 = 不限制（参考真实 Excel 的筛选面板交互） */
  var flowKinds = [];

  /* 取流水的变更类型名：导入数据带 kind 字段，内置占位流水用方向兜底 */
  function flowKindOf(f) {
    return (f.carrier && f.carrier !== '入库' && f.carrier !== '出库')
      ? f.carrier
      : (f.type === 'in' ? '入库' : '出库');
  }

  /* 变更类型筛选器：带各类型计数 + 全选/反选 */
  function renderFlowKindFilter() {
    var box = $('flowKindFilter');
    if (!box) return;
    /* 统计各类型出现次数，按数量降序（与 Excel 筛选面板一致） */
    var cnt = {};
    FLOWS.forEach(function (f) {
      var k = flowKindOf(f);
      if (k === '入库' || k === '出库') return;   /* 方向已由上方 Tab 单独控制，此处不重复列出 */
      cnt[k] = (cnt[k] || 0) + 1;
    });
    var keys = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
    if (!keys.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
    box.style.display = '';
    var all = keys.every(function (k) { return flowKinds.indexOf(k) >= 0; });
    var html = '<div class="flow-kind-head">' +
      '<span class="flow-kind-title">变更类型</span>' +
      '<button type="button" class="flow-kind-op" data-op="all">' + (all ? '全选' : '全不选') + '</button>' +
      '<button type="button" class="flow-kind-op" data-op="invert">反选</button>' +
      (flowKinds.length ? '<button type="button" class="flow-kind-op" data-op="clear">清除</button>' : '') +
      '</div><div class="flow-kind-list">';
    keys.forEach(function (k) {
      var on = flowKinds.indexOf(k) >= 0;
      html += '<label class="flow-kind-item' + (on ? ' on' : '') + '">' +
        '<input type="checkbox" data-kind="' + escapeAttr(k) + '"' + (on ? ' checked' : '') + ' />' +
        '<span class="flow-kind-name">' + escapeHtml(k) + '</span>' +
        '<span class="flow-kind-n">' + cnt[k] + '</span></label>';
    });
    box.innerHTML = html + '</div>';
  }
  /* 分页器的 getData 闭包会固化首次创建时的数组引用 → 必须读模块级实时状态，
     否则切换筛选后 hint 已更新但表格仍是旧数据 */
  var flowViewList = [], slowViewList = [];

  function renderStockPage() {
    try {
    if (!$('stockKpis')) return;
    renderStockKpis();
    renderFlow();
    renderAlertCfg();
    renderAlertList();
    renderConsume();
    renderSlowSell();
    renderStockImportOverview();
    } catch(err) { document.body.setAttribute('data-err', err.message + ' | ' + String(err.stack||'').split(String.fromCharCode(10))[1]); }
  }

  function renderStockKpis() {
    var k = computeKpis();
    var box = $('stockKpis');
    box.innerHTML =
      '<div class="stock-kpi"><div class="stock-kpi-k">在管仓库</div><div class="stock-kpi-v">' + k.wh + '</div><div class="stock-kpi-sub">' + k.rack + ' 个货架 · ' + CATEGORIES.length + ' 个品类</div></div>' +
      '<div class="stock-kpi"><div class="stock-kpi-k">总体占用率</div><div class="stock-kpi-v">' + k.rate + '%</div><div class="stock-kpi-sub">' + k.stock + ' / ' + k.cap + ' 件</div></div>' +
      '<div class="stock-kpi"><div class="stock-kpi-k">近 7 天入库</div><div class="stock-kpi-v">+' + k.weekIn + '</div><div class="stock-kpi-sub">件</div></div>' +
      '<div class="stock-kpi"><div class="stock-kpi-k">近 7 天出库</div><div class="stock-kpi-v">−' + k.weekOut + '</div><div class="stock-kpi-sub">件</div></div>' +
      '<div class="stock-kpi' + (k.alertCount ? ' alert' : '') + '"><div class="stock-kpi-k">库存预警</div><div class="stock-kpi-v">' + k.alertCount + '</div><div class="stock-kpi-sub">条待处理</div></div>';
  }

  function renderFlow() {
    var body = $('stockFlowBody');
    if (!body) return;
    var list = FLOWS.filter(function (f) {
      if (flowFilter !== 'all' && f.type !== flowFilter) return false;
      /* 变更类型多选筛选：flowKinds 为空表示不限制 */
      if (flowKinds.length && flowKinds.indexOf(flowKindOf(f)) < 0) return false;
      if (!flowKw) return true;
      var k = flowKw.toLowerCase();
      return (f.id + f.goods + f.staff + f.rackCode + f.carrier + (f.orderNo || '')).toLowerCase().indexOf(k) !== -1;
    });
    flowViewList = list;
    var hint = $('stockFlowHint');
    if (hint) hint.textContent = '— ' + list.length + ' / ' + FLOWS.length + ' 条记录';
    var fb = $('tabFlowBadge');
    if (fb) { fb.textContent = FLOWS.length; }
    renderFlowKindFilter();

    if (!flowPager) {
      flowPager = createPager($('stockFlowPager'), {
        pageSize: 12,
        getData: function () { return flowViewList; },
        onPage: function (rows, page, size, total) {
          if (!total) {
            body.innerHTML = '<tr><td colspan="8" class="empty">' +
              (FLOWS.length ? '没有符合筛选条件的出入库记录' : '暂无出入库数据，请先在「数据导入」中导入库存变更表') + '</td></tr>';
            return;
          }
          var html = '';
          rows.forEach(function (f) {
            var d = new Date(f.time);
            var ts = (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
              String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
            html += '<tr>' +
              '<td class="code-cell">' + escapeHtml(f.orderNo || f.id) + '</td>' +
              '<td><span class="tag ' + (f.type === 'in' ? 'tag-ok' : 'tag-soft') + '">' + (f.type === 'in' ? '入库' : '出库') + '</span></td>' +
              '<td><span class="tag tag-mute">' + escapeHtml(flowKindOf(f)) + '</span></td>' +
              '<td>' + escapeHtml(f.whName) + ' / ' + escapeHtml(f.rackCode) + (f.level ? ' · ' + f.level + '层' : '') + '</td>' +
              '<td>' + escapeHtml(f.goods) + '<div class="stock-mini-m">' + escapeHtml(f.sku) + '</div></td>' +
              '<td class="num">' + (f.type === 'in' ? '+' : '−') + f.qty + '</td>' +
              '<td>' + escapeHtml(f.staff) + '</td>' +
              '<td>' + ts + '</td>' +
              '</tr>';
          });
          body.innerHTML = html;
        }
      });
    } else {
      flowPager.draw();
    }
    flowPager.draw();
  }

  function renderAlertCfg() {
    var box = $('stockAlertConfig');
    if (!box) return;
    var cfg = loadAlertCfg();
    var n = computeAlerts(cfg).length;
    var hint = $('stockAlertHint');
    if (hint) hint.textContent = '— 触发 ' + n + ' 条';
    box.innerHTML =
      '<div class="alert-row">' +
      '<div class="alert-row-k">启用预警<small>关闭后不再计算触发规则</small></div>' +
      '<div class="alert-row-ctrl"><div class="switch' + (cfg.on ? ' on' : '') + '" id="alertSwitch" role="switch" aria-checked="' + cfg.on + '" tabindex="0"></div></div>' +
      '</div>' +
      '<div class="alert-row">' +
      '<div class="alert-row-k">低库存阈值<small>货位库存低于该值时预警</small></div>' +
      '<div class="alert-row-ctrl"><input type="number" id="cfgLowStock" min="0" value="' + cfg.lowStock + '" /><span class="alert-row-unit">件</span></div>' +
      '</div>' +
      '<div class="alert-row">' +
      '<div class="alert-row-k">高占用阈值<small>货位占用金额超过该值时预警</small></div>' +
      '<div class="alert-row-ctrl"><input type="number" id="cfgHighValue" min="0" value="' + cfg.highValue + '" /><span class="alert-row-unit">元</span></div>' +
      '</div>' +
      '<div class="alert-row">' +
      '<div class="alert-row-k">滞销判定天数<small>超期未出库判定为滞销</small></div>' +
      '<div class="alert-row-ctrl"><input type="number" id="cfgStaleDays" min="1" value="' + cfg.staleDays + '" /><span class="alert-row-unit">天</span></div>' +
      '</div>' +
      '<div class="alert-row alert-row-block">' +
      '<div class="alert-row-k">礼品排除关键词<small>命中名称/品类的礼品不参与预警与消耗分析，逗号分隔</small></div>' +
      '<div class="alert-row-ctrl" style="width:100%"><input type="text" id="cfgExcludeKeywords" class="alert-exclude-input" value="' +
        String(cfg.excludeKeywords || '').replace(/"/g, '&quot;') +
        '" placeholder="游戏币,卡牌,彩票" /></div>' +
      '</div>';

    var sw = $('alertSwitch');
    function flip() {
      var c = loadAlertCfg(); c.on = !c.on; saveAlertCfg(c);
      renderAlertCfg(); renderAlertList(); renderStockKpis(); updateAlertBadge();
    }
    if (sw) { sw.addEventListener('click', flip); sw.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } }); }
    [['cfgLowStock', 'lowStock'], ['cfgHighValue', 'highValue'], ['cfgStaleDays', 'staleDays']].forEach(function (pair) {
      var el = $(pair[0]);
      if (!el) return;
      el.addEventListener('change', function () {
        var c = loadAlertCfg();
        var v = parseInt(el.value, 10);
        if (!isNaN(v) && v >= 0) { c[pair[1]] = v; saveAlertCfg(c); }
        renderAlertCfg(); renderAlertList(); renderStockKpis(); renderSlowSell(); renderConsume(); updateAlertBadge();
      });
    });
    var exEl = $('cfgExcludeKeywords');
    if (exEl) {
      exEl.addEventListener('change', function () {
        var c = loadAlertCfg();
        c.excludeKeywords = String(exEl.value || '').trim();
        saveAlertCfg(c);
        renderAlertCfg(); renderAlertList(); renderStockKpis(); renderSlowSell(); renderConsume(); updateAlertBadge();
      });
    }
  }

  var alertListPager = null;
  function renderAlertListRows(rows) {
    var box = $('stockAlertList');
    if (!box) return;
    if (!rows || !rows.length) {
      box.innerHTML = '<div class="alert-empty">当前无触发预警</div>';
      return;
    }
    var html = '<div class="alert-list">';
    rows.forEach(function (a) {
      html += '<div class="alert-item ' + (a.level === 'warn' ? 'warn' : '') + '">' +
        '<iconify-icon icon="ant-design:' + (a.level === 'warn' ? 'money-collect-outlined' : 'warning-outlined') + '" width="13" height="13"></iconify-icon>' +
        '<span class="alert-item-n">' + escapeHtml(a.rackCode) + ' · 第 ' + a.levelNo + ' 层 · ' + escapeHtml(a.cat) + '</span>' +
        '<span class="alert-item-m">' + escapeHtml(a.msg) + '</span>' +
        '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
  }
  function renderAlertList() {
    var alerts = computeAlerts(loadAlertCfg());
    var mount = $('stockAlertPager');
    if (!alerts.length) {
      renderAlertListRows([]);
      if (mount) mount.style.display = 'none';
      return;
    }
    if (mount && typeof createPager === 'function') {
      if (!alertListPager) {
        alertListPager = createPager(mount, {
          pageSize: 10,
          getData: function () { return computeAlerts(loadAlertCfg()); },
          onPage: function (rows) { renderAlertListRows(rows); }
        });
      }
      alertListPager.draw();
    } else {
      renderAlertListRows(alerts);
    }
  }

  function renderConsume() {
    var chart = $('stockConsumeChart');
    if (!chart) return;
    var rows = computeConsume();
    var top = rows.slice(0, 8);
    var max = top.length ? top[0].qty : 1;
    var html = '';
    top.forEach(function (r) {
      var pct = max ? Math.round(r.qty / max * 100) : 0;
      html += '<div class="consume-row">' +
        '<span class="consume-name" title="' + escapeAttr(r.name) + '">' + escapeHtml(r.name) + '</span>' +
        '<span class="consume-bar-wrap"><span class="consume-bar' + (r.tier === 'low' ? ' low' : '') + '" style="width:' + pct + '%"></span></span>' +
        '<span class="consume-val"><span class="consume-val-n">' + r.qty + '</span><span class="consume-val-u">件</span></span>' +
        '</div>';
    });
    chart.innerHTML = html || '<div class="alert-empty">暂无出库数据</div>';

    var high = rows.filter(function (r) { return r.tier === 'high'; });
    var low = rows.filter(function (r) { return r.tier === 'low'; });
    $('stockHighList').innerHTML = miniList(high.length ? high : rows.filter(function (r) { return r.qty > 0; }).slice(0, 4), '高');
    $('stockLowList').innerHTML = miniList(low.length ? low : rows.slice(-3), '低');
  }

  function miniList(rows, tag) {
    if (!rows.length) return '<div class="alert-empty">暂无' + tag + '消耗礼品</div>';
    var html = '';
    rows.slice(0, 5).forEach(function (r) {
      html += '<div class="stock-mini">' +
        '<span class="stock-mini-n" title="' + escapeAttr(r.name) + '">' + escapeHtml(r.name) + '</span>' +
        '<span class="stock-mini-qty"><span class="stock-mini-v">' + r.qty + '</span><span class="stock-mini-m">件</span></span>' +
        '</div>';
    });
    return html;
  }

  /* 把消耗数据转为 { sku: qty } 映射，供滞销分析复用。
     优先用历史导入数据（长期趋势更能反映滞销），其次当前导入，最后回退 FLOWS 计算 */
  function buildConsumeMap() {
    var map = {};
    if (STOCK_IMPORT.history && STOCK_IMPORT.history.bySku) {
      Object.keys(STOCK_IMPORT.history.bySku).forEach(function (sku) {
        map[sku] = STOCK_IMPORT.history.bySku[sku].qty;
      });
      return map;
    }
    if (STOCK_IMPORT.current && STOCK_IMPORT.current.bySku) {
      Object.keys(STOCK_IMPORT.current.bySku).forEach(function (sku) {
        map[sku] = STOCK_IMPORT.current.bySku[sku].qty;
      });
      return map;
    }
    computeConsume().forEach(function (r) { map[r.sku] = r.qty; });
    return map;
  }

  function renderSlowSell() {
    var body = $('stockSlowBody');
    if (!body) return;
    var cfg = loadAlertCfg();
    var all = computeSlowSell(cfg, buildConsumeMap());
    var list = all.filter(function (r) {
      if (slowFilter === 'stale') return r.stale;
      if (slowFilter === 'high') return r.high;
      return true;
    });
    slowViewList = list;
    var hint = $('stockSlowHint');
    if (hint) hint.textContent = '— ' + list.length + ' 项 / 合计 ¥' + list.reduce(function (s, r) { return s + r.value; }, 0).toLocaleString();

    if (!slowPager) {
      slowPager = createPager($('stockSlowPager'), {
        pageSize: 10,
        getData: function () { return slowViewList; },
        onPage: function (rows, page, size, total) {
          if (!total) { body.innerHTML = '<tr><td colspan="8" class="empty">没有匹配的滞销礼品</td></tr>'; return; }
          var html = '';
          rows.forEach(function (r) {
            var lo = r.lastOut ? (r.lastOut.getMonth() + 1) + '/' + r.lastOut.getDate() : '无记录';
            var adv = r.advice || { text: '暂不处理', level: 'muted' };
            html += '<tr>' +
              '<td>' + escapeHtml(r.name) + '<div class="stock-mini-m">' + r.sku + '</div></td>' +
              '<td>' + escapeHtml(r.cat) + '</td>' +
              '<td>' + escapeHtml(r.wh) + ' / ' + escapeHtml(r.rackCode) + '</td>' +
              '<td class="num">' + r.qty + '</td>' +
              '<td class="num">¥' + r.value.toLocaleString() + '</td>' +
              '<td class="num">' + lo + '</td>' +
              '<td><span class="tag ' + (r.stale ? 'tag-ok' : 'tag-soft') + '">' + (r.stale ? '超期未动' : '高占用') + '</span></td>' +
              '<td><span class="tag advice-' + adv.level + '">' + escapeHtml(adv.text) + '</span></td>' +
              '</tr>';
          });
          body.innerHTML = html;
        }
      });
    }
    slowPager.draw();
  }

  function updateAlertBadge() {
    var n = computeAlerts(loadAlertCfg()).length;
    var b = $('menuAlertBadge');
    if (b) { b.textContent = n; b.style.display = n > 0 ? '' : 'none'; }
    /* 同步库存预警 Tab 徽标 */
    var tb = $('tabAlertBadge');
    if (tb) { tb.textContent = n; tb.style.display = n > 0 ? '' : 'none'; }
  }

  /* 事件绑定（只绑一次） */
  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    /* 库存管理子页 Tab 切换 */
  var tabs = $('stockTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    var t = (e.target && e.target.closest) ? e.target.closest('.sub-tab') : null;
    if (!t) return;
    var key = t.getAttribute('data-stab');
    tabs.querySelectorAll('.sub-tab').forEach(function (b) {
      var on = b === t;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('#page-wh-stock [data-stab-panel]').forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-stab-panel') === key);
    });
  });
  var fBar = $('stockFlowFilters');
    if (fBar) fBar.addEventListener('click', function (e) {
      var t = (e.target && e.target.closest) ? e.target.closest('button[data-sflow]') : null;
      if (!t) return;
      flowFilter = t.getAttribute('data-sflow');
      fBar.querySelectorAll('button[data-sflow]').forEach(function (b) { b.classList.toggle('active', b === t); });
      /* 过滤条件变了：必须先重算 flowViewList 再让分页器重绘。
         【旧实现 bug】写的是 flowPager.reset()，但 reset() 内部只重置页码再 draw()，
         而 draw() 通过 opts.getData() 读的是旧的 flowViewList —— 数据从未按新过滤条件重算，
         表现就是按钮高亮切了但列表内容不变（实测点「入库」后表格仍是「出库」）。
         renderFlow() 内部会先 filter 出新 flowViewList，再调用 draw()，二者顺序正确。 */
      renderFlow();
    });
    var fIn = $('stockFlowSearch');
    var fBtn = $('btnStockFlowSearch');
    if (fBtn && !fBtn.__bound) {
      fBtn.__bound = true;
      fBtn.addEventListener('click', function (e) {
        e.preventDefault();
        flowKw = fIn ? (fIn.value || '').trim() : '';
        renderFlow();
      });
    }
    if (fIn && !fIn.__boundEnter) {
      fIn.__boundEnter = true;
      fIn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          flowKw = (fIn.value || '').trim();
          renderFlow();
        }
      });
    }

    /* 变更类型筛选：change 用委托（复选框被 innerHTML 重绘，需委托而非逐个绑定） */
    var kBar = $('flowKindFilter');
    if (kBar) {
      kBar.addEventListener('change', function (e) {
        var cb = (e.target && e.target.closest) ? e.target.closest('input[data-kind]') : null;
        if (!cb) return;
        var k = cb.getAttribute('data-kind');
        var i = flowKinds.indexOf(k);
        if (cb.checked) { if (i < 0) flowKinds.push(k); }
        else if (i >= 0) flowKinds.splice(i, 1);
        renderFlow();
        if (flowPager) flowPager.reset();
      });
      kBar.addEventListener('click', function (e) {
        var op = (e.target && e.target.closest) ? e.target.closest('.flow-kind-op') : null;
        if (!op) return;
        var mode = op.getAttribute('data-op');
        var keys = [];
        kBar.querySelectorAll('input[data-kind]').forEach(function (cb) { keys.push(cb.getAttribute('data-kind')); });
        if (mode === 'all') flowKinds = (flowKinds.length === keys.length) ? [] : keys.slice();
        else if (mode === 'invert') {
          var next = [];
          keys.forEach(function (k) { if (flowKinds.indexOf(k) < 0) next.push(k); });
          flowKinds = next;
        } else if (mode === 'clear') flowKinds = [];
        else return;
        renderFlow();
        if (flowPager) flowPager.reset();
      });
    }

    var sBar = $('stockSlowFilters');
    if (sBar) sBar.addEventListener('click', function (e) {
      var t = (e.target && e.target.closest) ? e.target.closest('button[data-slow]') : null;
      if (!t) return;
      slowFilter = t.getAttribute('data-slow');
      sBar.querySelectorAll('button[data-slow]').forEach(function (b) { b.classList.toggle('active', b === t); });
      /* 必须重算 list：分页器 getData 闭包持有创建时的 list，仅 reset() 不够 */
      renderSlowSell();
      if (slowPager) slowPager.reset();
    });

    /* ----- 数据导入 Tab 事件 ----- */
    var stockUpload = $('stockUploadArea');
    var stockFile = $('stockExcelFile');
    if (stockUpload && stockFile) {
      stockUpload.addEventListener('click', function () { stockFile.click(); });
      stockFile.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
          var mode = getStockImportMode();
          parseStockImport(e.target.files[0], mode);
        }
        e.target.value = '';
      });
      stockUpload.addEventListener('dragover', function (e) { e.preventDefault(); stockUpload.classList.add('dragover'); });
      stockUpload.addEventListener('dragleave', function () { stockUpload.classList.remove('dragover'); });
      stockUpload.addEventListener('drop', function (e) {
        e.preventDefault(); stockUpload.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          var mode = getStockImportMode();
          parseStockImport(e.dataTransfer.files[0], mode);
        }
      });
    }
    var importClear = $('stockImportClear');
    if (importClear) importClear.addEventListener('click', function () {
      showModal('确定清空已导入的历史与当前数据？消耗分析将回退到系统内置流水。', 'confirm', function (ok) {
        if (!ok) return;
        STOCK_IMPORT = { history: null, current: null };
        try { localStorage.removeItem(STOCK_IMPORT_KEY); } catch (e) {}
        /* 清空后同步重建布局与流水，园区/KPI 立即回到空态 */
        rebuildLayouts();
        applyRackCustom();
        rebuildFlows();
        renderStockImportOverview();
        renderConsume();
        renderSlowSell();
        renderStockKpis();
        hideModal();
        toast('已清空导入数据', 'success');
      });
    });
    var importTpl = $('stockImportTemplate');
    if (importTpl) importTpl.addEventListener('click', downloadStockImportTemplate);
  }

  /* 获取当前选中的导入模式 */
  function getStockImportMode() {
    var checked = document.querySelector('input[name="stockImportMode"]:checked');
    return checked ? checked.value : 'history';
  }

  /* 下载导入模板（CSV，UTF-8 BOM 防 Excel 乱码） */
  /* 导入模板：以「库存变更查询」导出的标准表头为准（19 列），
     用 XLSX 生成真正的 .xlsx（而非 CSV），与用户在系统中导出的原始文件格式一致。 */
  var IMPORT_HEADERS = ['仓库', '商品名称', '商品编码', '商品分类', '单位',
    '原数量', '变更数量', '变更后数量', '变更金额', '变更含税金额',
    '变更类型', '摘要', '单号', '备注', '变更时间', '账期',
    '供应商', '操作人', '操作终端'];

  function downloadStockImportTemplate() {
    if (typeof XLSX === 'undefined') { toast('Excel 组件未加载，无法生成模板', 'error'); return; }
    /* 示例行取自真实业务形态：负数=出库消耗，正数=入库 */
    var samples = [
      ['上海中心仓', '中秋团圆礼盒·典藏', '80001388', '礼品/礼盒', '件', '160', '-12', '148', '-3936', '-4418.56', '领用', '销售出库', 'E5924000600052609305345634', '', '2026-09-30 22:34:35', '2026-09-30', '', '露西（王楚）', '礼品兑换处'],
      ['上海中心仓', '精选干红葡萄酒', '80002101', '礼品/酒水', '瓶', '58', '-6', '52', '-828', '-928.00', '领用', '销售出库', 'E5924000600052609305345701', '', '2026-09-30 20:11:08', '2026-09-30', '', '张启明', '礼品兑换处'],
      ['杭州分仓', '商务伴手礼·简约款', '80001502', '礼品/礼盒', '件', '0', '40', '40', '6720', '7526.40', '采购入库', '采购收货', 'E5924000600052609305345822', '首批入库', '2026-09-29 10:02:51', '2026-09-29', '杭州礼品供应商', '李慧敏', '收货区'],
      ['杭州分仓', '每日坚果礼罐', '80003311', '礼品/食品', '罐', '0', '24', '24', '2832', '3171.84', '采购入库', '采购收货', 'E5924000600052609305345901', '', '2026-09-29 09:41:16', '2026-09-29', '杭州食品供应', '王振华', '收货区']
    ];
    var aoa = [IMPORT_HEADERS].concat(samples);
    try {
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      /* 列宽：让模板在 Excel 中可直接阅读，不必手动拉列 */
      ws['!cols'] = IMPORT_HEADERS.map(function (h, i) {
        return { wch: i === 1 ? 24 : (i === 2 ? 14 : (i === 12 ? 26 : Math.max(10, h.length * 2.2))) };
      });
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '库存变更数据');
      XLSX.writeFile(wb, '库存变更数据导入模板.xlsx');
      toast('模板已下载（.xlsx，含标准 19 列表头）', 'success');
    } catch (err) {
      /* XLSX 不可用时降级为 CSV，保证功能不中断 */
      var csv = '﻿' + aoa.map(function (r) {
        return r.map(function (c) { return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
      }).join('\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = '库存变更数据导入模板.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 200);
      toast('Excel 组件异常，已降级为 CSV 模板', 'warning');
    }
  }

  /* 页面进入时渲染 */
  function enterPark() {
    bind();
    bindParkToolbar();
    initR3F();
    renderWhSwitch();
    renderLegend();
    /* 重新进入时若 R3F 已就绪但容器已被卸载，需重建 holder 再挂载 */
    if (r3fReady && parkApp) {
      var st = $('parkStage');
      if (st && !st.querySelector('#parkCanvas')) {
        var oldScene2 = st.querySelector('#parkScene');
        if (oldScene2 && oldScene2.parentNode) oldScene2.parentNode.removeChild(oldScene2);
        /* 同步清掉 CSS 3D 降级路径遗留的标签（与 initR3F 同一原因） */
        var oldLabels2 = $('parkLabelLayer');
        if (oldLabels2) oldLabels2.innerHTML = '';
        var h2 = document.createElement('div');
        h2.id = 'parkCanvas';
        st.insertBefore(h2, st.firstChild);
      }
      renderPark();
      bindR3FStageHints(st);
    } else {
      renderPark();
    }
    renderPanelEmpty();
    if (autoRotate && scene) startSpin();
    updateAlertBadge();
  }
  function enterStock() {
    bind();
    renderStockPage();
  }
  function leave() {
    stopSpin();
    stopR3FStageHints();
    hideParkFloat();
    selectedRack = null;
    var hint = $('parkNavHint');
    if (hint) hint.classList.remove('show');
    if (parkApp) { try { parkApp.unmount(); } catch (e) {} }
    r3fMounted = false;
    var stLeave = $('parkStage');
    if (stLeave) { stLeave.classList.remove('r3f-active'); stLeave.removeAttribute('data-render'); }
  }

  /* 数据看板用的仓库侧概览。
     复用与「库存管理」页完全相同的计算函数（computeKpis / computeSlowSell / computeConsume），
     保证看板与库存管理页的数字口径一致，不会出现两处算法漂移。 */
  /* 时间范围边界：thisWeek / lastWeek / thisMonth */
  function getRangeBounds(range) {
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var start, end, day;
    if (range === 'lastWeek') {
      day = now.getDay() || 7;
      end = new Date(now);
      end.setDate(now.getDate() - day);
      start = new Date(end);
      start.setDate(end.getDate() - 6);
    } else if (range === 'last30Days') {
      end = new Date(now.getTime());
      start = new Date(now.getTime());
      start.setDate(now.getDate() - 29);
    } else if (range === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getTime());
    } else {
      day = now.getDay() || 7;
      start = new Date(now);
      start.setDate(now.getDate() - (day - 1));
      end = new Date(now.getTime());
    }
    end.setHours(23, 59, 59, 999);
    return { start: start, end: end };
  }

  /* 礼品出库趋势：按日落点，支持本周/上周/近30天/本月 */
  function getConsumeTrend(range) {
    range = range || 'thisWeek';
    var b = getRangeBounds(range);
    var buckets = [];
    var cur = new Date(b.start.getFullYear(), b.start.getMonth(), b.start.getDate());
    var endDay = new Date(b.end.getFullYear(), b.end.getMonth(), b.end.getDate());
    var guard = 0;
    while (cur.getTime() <= endDay.getTime() && guard < 62) {
      buckets.push({
        key: cur.getFullYear() + '-' + (cur.getMonth() + 1) + '-' + cur.getDate(),
        label: (cur.getMonth() + 1) + '/' + cur.getDate(),
        qty: 0,
        time: cur.getTime()
      });
      cur.setDate(cur.getDate() + 1);
      guard++;
    }
    var map = {};
    buckets.forEach(function (x) { map[x.key] = x; });
    FLOWS.forEach(function (f) {
      if (!f || f.type !== 'out') return;
      var t = f.time instanceof Date ? new Date(f.time.getTime()) : new Date(f.time);
      if (isNaN(t.getTime())) return;
      if (t.getTime() < b.start.getTime() || t.getTime() > b.end.getTime()) return;
      var key = t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate();
      var slot = map[key];
      if (slot) slot.qty += (f.qty || 0);
    });
    return buckets;
  }

  var __ovCache = null, __ovKey = '';
  function flowStamp() {
    return FLOWS.length + ':' + (FLOWS[0] && FLOWS[0].id ? FLOWS[0].id : '') + ':' + (STOCK_IMPORT && STOCK_IMPORT.current ? 1 : 0);
  }
  function getOverview() {
    var key = flowStamp() + ':' + WAREHOUSES.length;
    if (__ovCache && __ovKey === key) return __ovCache;

    var cfg = loadAlertCfg();
    var k = computeKpis();
    var slow = computeSlowSell(cfg, buildConsumeMap());
    var slowValue = slow.reduce(function (s, r) { return s + r.value; }, 0);
    var slowQty = slow.reduce(function (s, r) { return s + r.qty; }, 0);
    /* TOP 5 排序口径：有单价按占用金额，无单价（金额恒 0）按滞销数量，
       与看板饼图切分口径保持一致，避免「其他」切片吞掉整张饼图 */
    var top = slow.slice().sort(function (a, b) {
      return slowValue > 0 ? (b.value - a.value) : (b.qty - a.qty);
    }).slice(0, 5);
    var consume = computeConsume();
    /* 近 7 日分仓出入库（看板出入库环形图） */
    var flowMap = {};
    WAREHOUSES.forEach(function (w) { flowMap[w.id] = { name: w.name, inQty: 0, outQty: 0 }; });
    var nowFlow = Date.now();
    FLOWS.forEach(function (f) {
      if (!f || !f.time) return;
      var ts = f.time instanceof Date ? f.time.getTime() : new Date(f.time).getTime();
      if (isNaN(ts) || nowFlow - ts > 7 * 864e5) return;
      var slot = flowMap[f.whId];
      if (!slot) {
        slot = { name: f.whName || f.whId || '未知仓', inQty: 0, outQty: 0 };
        flowMap[f.whId || f.whName || 'x'] = slot;
      }
      if (f.type === 'in') slot.inQty += (f.qty || 0);
      else if (f.type === 'out') slot.outQty += (f.qty || 0);
    });
    var flowByWh = Object.keys(flowMap).map(function (id) { return flowMap[id]; });

    /* 分仓库存：看板环形图「各仓库存占比」数据源（与布局同源，无二次口径） */
    var byWh = WAREHOUSES.map(function (wh) {
      var s = 0;
      LAYOUTS[wh.id].racks.forEach(function (r) {
        r.levels.forEach(function (lv) { s += lv.stock; });
      });
      return { name: wh.name, stock: s };
    });
    __ovKey = key;
    __ovCache = {
      wh: k.wh, rack: k.rack, rate: k.rate, stock: k.stock, cap: k.cap,
      weekIn: k.weekIn, weekOut: k.weekOut, alertCount: k.alertCount,
      slowCount: slow.length, slowValue: slowValue, slowQty: slowQty, topSlow: top,
      giftSku: consume.length, byWh: byWh,
      consumeTrend: getConsumeTrend('thisWeek'),
      flowByWh: flowByWh
    };
    return __ovCache;
  }

  /* 当前 3D 视角状态（相机位置 / 控制器参数）。
     供宿主同步「俯视」按钮态与操作提示，也便于自动化验证平移缩放是否生效。 */
  function getParkView() {
    if (r3fReady && parkApp && parkApp.getView) {
      var v = parkApp.getView();
      v.mode = navMode;
      return v;
    }
    return { pos: null, target: null, cam: cam, mode: navMode, view: 'css3d' };
  }
  /* 当前拖动模式：'rotate' | 'pan' */
  function getNavMode() { return navMode; }

  var api = {
    WAREHOUSES: WAREHOUSES,
    enterPark: enterPark,
    enterStock: enterStock,
    leave: leave,
    updateAlertBadge: updateAlertBadge,
    getOverview: getOverview,
    getConsumeTrend: getConsumeTrend,
    getRangeBounds: getRangeBounds,
    getParkView: getParkView,
    getNavMode: getNavMode
  };

  /* 对外桥接：WH 是主 IIFE 内的闭包变量，外部脚本访问不到。
     这里只挂只读查询接口，不暴露任何写操作。 */
  /* 启动时预加载 R3F，避免进入园区时仍卡在 CSS 3D 旧画面 */
  setTimeout(function () { try { initR3F(); } catch (e) {} }, 80);

  window.WH = api;
  return api;
})();
