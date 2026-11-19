/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/**
 * Park3D — 仓库数字孪生（性能优化版）
 * React 18 + R3F + drei · 嵌入主站 #/wh-park
 * 性能要点：demand 渲染、共享材质、阴影降配、标签仅选中显示、dpr 上限
 */
import React, { useMemo, useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { Canvas, useThree, useFrame, invalidate } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';

var h = React.createElement;

var C = {
  frame: '#1e293b',
  shelfTop: '#f1f5f9',
  floor: '#f8fafc',
  grid: '#cbd5e1',
  bg: '#f1f5f9',
  high: '#22c55e',
  mid: '#eab308',
  low: '#ef4444',
  empty: '#94a3b8',
};

/* 共享材质：避免每个 mesh 新建 Material（显著降 draw 开销） */
var MAT = {
  frame: new THREE.MeshLambertMaterial({ color: C.frame }),
  frameSel: new THREE.MeshLambertMaterial({ color: '#0f172a' }),
  shelf: new THREE.MeshLambertMaterial({ color: C.shelfTop }),
  shelfSel: new THREE.MeshLambertMaterial({ color: '#bfdbfe', emissive: new THREE.Color('#3b82f6'), emissiveIntensity: 0.18 }),
  shelfHover: new THREE.MeshLambertMaterial({ color: '#e2e8f0' }),
  base: new THREE.MeshLambertMaterial({ color: '#cbd5e1' }),
  baseSel: new THREE.MeshLambertMaterial({ color: '#93c5fd' }),
  floor: new THREE.MeshLambertMaterial({ color: C.floor }),
  ground: new THREE.MeshLambertMaterial({ color: C.bg }),
  wall: new THREE.MeshLambertMaterial({ color: '#64748b' }),
  zone: new THREE.MeshBasicMaterial({ color: '#e2e8f0', transparent: true, opacity: 0.4, depthWrite: false }),
  zoneDoor: new THREE.MeshBasicMaterial({ color: '#bbf7d0', transparent: true, opacity: 0.45, depthWrite: false }),
  inv: new THREE.MeshBasicMaterial({ visible: false }),
  high: new THREE.MeshLambertMaterial({ color: C.high }),
  mid: new THREE.MeshLambertMaterial({ color: C.mid }),
  low: new THREE.MeshLambertMaterial({ color: C.low }),
  empty: new THREE.MeshLambertMaterial({ color: C.empty }),
  cargoSel: new THREE.MeshLambertMaterial({ color: '#60a5fa' }),
};

function stockMat(rate) {
  if (rate <= 0.02) return MAT.empty;
  if (rate < 0.3) return MAT.low;
  if (rate < 0.7) return MAT.mid;
  return MAT.high;
}

function stockColor(rate) {
  if (rate <= 0.02) return C.empty;
  if (rate < 0.3) return C.low;
  if (rate < 0.7) return C.mid;
  return C.high;
}

function boundsOf(layout) {
  var racks = (layout && layout.racks) || [];
  var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (var i = 0; i < racks.length; i++) {
    var r = racks[i];
    var w = (r.rw || 1) * 0.55, d = (r.rd || 0.5) * 0.55;
    var x = r.wx || 0, z = r.wz || 0;
    if (x - w < minX) minX = x - w;
    if (x + w > maxX) maxX = x + w;
    if (z - d < minZ) minZ = z - d;
    if (z + d > maxZ) maxZ = z + d;
  }
  if (!isFinite(minX)) { minX = -4; maxX = 4; minZ = -3; maxZ = 3; }
  var room = layout && layout.room;
  if (room) {
    if (-room.w / 2 < minX) minX = -room.w / 2;
    if (room.w / 2 > maxX) maxX = room.w / 2;
    if (-room.d / 2 < minZ) minZ = -room.d / 2;
    if (room.d / 2 > maxZ) maxZ = room.d / 2;
  }
  var pad = 1.2;
  return {
    minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad,
    centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2,
    width: maxX - minX + pad * 2, depth: maxZ - minZ + pad * 2,
  };
}

/* 单层：最多 3 箱，无阴影投射 */
function ShelfLevel(props) {
  var rack = props.rack, level = props.level, y = props.y, w = props.w, d = props.d;
  var selected = props.selected, selectedLevel = props.selectedLevel, onPick = props.onPick;
  var hv = useState(false);
  var hovered = hv[0], setHovered = hv[1];
  var isSel = selected && selectedLevel === level.level;
  var rate = level.capacity > 0 ? Math.min(1, (level.stock || 0) / level.capacity) : 0;
  var boxCount = rate > 0.02 ? Math.max(1, Math.min(3, Math.round(rate * 3))) : 0;
  var boxW = (w * 0.8) / Math.max(boxCount, 1) * 0.88;
  var gap = (w * 0.8 - boxW * boxCount) / (boxCount + 1);
  var boardH = 0.04, cargoH = 0.14;

  var onClick = useCallback(function (e) {
    e.stopPropagation();
    if (onPick) onPick(rack, level.level);
  }, [rack, level, onPick]);

  var kids = [
    h('mesh', {
      key: 'b', receiveShadow: true, onClick: onClick,
      material: isSel ? MAT.shelfSel : hovered ? MAT.shelfHover : MAT.shelf,
      onPointerOver: function (e) {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
        invalidate();
      },
      onPointerOut: function () {
        setHovered(false);
        document.body.style.cursor = 'auto';
        invalidate();
      },
    },
      h('boxGeometry', { args: [w * 0.98, boardH, d * 0.96] })
    ),
  ];
  for (var i = 0; i < boxCount; i++) {
    var x = -w * 0.4 + gap + boxW / 2 + i * (boxW + gap);
    kids.push(h('mesh', {
      key: 'c' + i, position: [x, boardH / 2 + cargoH / 2, 0], onClick: onClick,
      material: isSel ? MAT.cargoSel : stockMat(rate),
    },
      h('boxGeometry', { args: [boxW, cargoH, d * 0.5] })
    ));
  }
  /* 浮层仅选中层显示，避免全场景 Html 拖垮帧率 */
  if (isSel) {
    var color = stockColor(rate);
    kids.push(h(Html, {
      key: 'tip', center: true, position: [0, boardH + cargoH + 0.28, 0],
      distanceFactor: 8, style: { pointerEvents: 'none' }, zIndexRange: [40, 0],
    },
      h('div', {
        style: {
          background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(15,23,42,0.12)',
          borderRadius: 8, padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap',
          boxShadow: '0 6px 18px rgba(15,23,42,0.12)', fontFamily: 'system-ui,sans-serif',
        },
      },
        h('b', null, rack.code + ' · L' + level.level),
        h('div', { style: { color: color, fontWeight: 700, marginTop: 2 } },
          (level.stock || 0) + '/' + (level.capacity || 0) + '（' + Math.round(rate * 100) + '%）')
      )
    ));
  }
  return h('group', { position: [0, y, 0] }, kids);
}

function RackMesh(props) {
  var rack = props.rack, selectedId = props.selectedId, selectedLevel = props.selectedLevel, onPick = props.onPick;
  var levels = rack.levels || [];
  var n = Math.max(1, levels.length);
  var vertical = rack.orientation === 'v';
  var w = Math.max(0.4, vertical ? (rack.rd || 0.45) : (rack.rw || 1));
  var d = Math.max(0.3, vertical ? (rack.rw || 1) : (rack.rd || 0.45));
  var levelGap = 0.36, baseY = 0.14;
  var selected = selectedId === rack.id;
  var post = 0.048;
  var topY = baseY + (n - 1) * levelGap + 0.04;
  var postH = topY + 0.02;

  var kids = [];
  var corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (var i = 0; i < 4; i++) {
    var c = corners[i];
    kids.push(h('mesh', {
      key: 'p' + i,
      position: [(w / 2 - post * 0.55) * c[0], postH / 2, (d / 2 - post * 0.55) * c[1]],
      castShadow: i < 2,
      material: selected ? MAT.frameSel : MAT.frame,
    },
      h('boxGeometry', { args: [post, postH, post] })
    ));
  }
  kids.push(h('mesh', {
    key: 'base', position: [0, 0.035, 0], receiveShadow: true,
    material: selected ? MAT.baseSel : MAT.base,
    onClick: function (e) { e.stopPropagation(); if (onPick) onPick(rack, null); },
  },
    h('boxGeometry', { args: [w + 0.12, 0.07, d + 0.12] })
  ));
  for (var li = 0; li < levels.length; li++) {
    kids.push(h(ShelfLevel, {
      key: levels[li].level, rack: rack, level: levels[li],
      y: baseY + li * levelGap, w: w, d: d,
      selected: selected, selectedLevel: selectedLevel, onPick: onPick,
    }));
  }
  /* 货架编号始终显示，便于与平面图（N-1 / W-1 / S-1…）对照 */
  kids.push(h(Html, {
    key: 'tag', position: [0, topY + 0.26, 0], center: true, distanceFactor: 10,
    style: { pointerEvents: 'none' }, zIndexRange: [20, 0],
  },
    h('div', {
      style: {
        background: selected ? 'rgba(37,99,235,0.95)' : 'rgba(255,255,255,0.92)',
        color: selected ? '#fff' : '#0f172a',
        border: selected ? 'none' : '1px solid rgba(15,23,42,0.12)',
        borderRadius: 5, padding: '1px 7px', fontSize: 11, fontWeight: 700,
        fontFamily: 'system-ui,sans-serif', whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(15,23,42,0.1)',
      },
    }, rack.code)
  ));
  return h('group', { position: [rack.wx || 0, 0, rack.wz || 0] }, kids);
}

function ZonePad(props) {
  var zone = props.zone;
  if (!zone) return null;
  var x = typeof zone.originX === 'number' ? zone.originX : (zone.pos ? zone.pos[0] : 0);
  var z = typeof zone.originZ === 'number' ? zone.originZ : (zone.pos ? zone.pos[1] : 0);
  if (zone.kind === 'wall') {
    var ww = zone.pw || 0.24, dd = zone.pd || 1.3;
    return h('mesh', { position: [x, 0.35, z], material: MAT.wall },
      h('boxGeometry', { args: [ww, 0.7, dd] })
    );
  }
  if (!zone.noRack && zone.kind !== 'aisle' && zone.kind !== 'door' && zone.kind !== 'area') return null;
  var w = zone.spanX || zone.pw || 1.5;
  var d = zone.spanZ || zone.pd || 1.2;
  var kids = [
    h('mesh', {
      key: 'pad', position: [0, 0, 0], rotation: [-Math.PI / 2, 0, 0],
      material: zone.kind === 'door' ? MAT.zoneDoor : MAT.zone,
    },
      h('planeGeometry', { args: [w, d] })
    ),
  ];
  if (zone.name) {
    kids.push(h(Html, {
      key: 'zn', position: [0, 0.06, 0], center: true, distanceFactor: 14,
      style: { pointerEvents: 'none' }, zIndexRange: [5, 0],
    },
      h('div', {
        style: {
          background: 'rgba(255,255,255,0.88)', borderRadius: 4, padding: '1px 6px',
          fontSize: 10, color: '#475569', fontFamily: 'system-ui,sans-serif', whiteSpace: 'nowrap',
          border: '1px solid rgba(15,23,42,0.08)',
        },
      }, zone.name)
    ));
  }
  return h('group', { position: [x, 0.012, z] }, kids);
}

function RoomWalls(props) {
  var w = props.w, d = props.d;
  var t = 0.12, hgt = 0.55;
  var mat = MAT.wall;
  return h(React.Fragment, null,
    h('mesh', { position: [0, hgt / 2, -d / 2 - t / 2], material: mat },
      h('boxGeometry', { args: [w + t * 2, hgt, t] })),
    h('mesh', { position: [0, hgt / 2, d / 2 + t / 2], material: mat },
      h('boxGeometry', { args: [w + t * 2, hgt, t] })),
    h('mesh', { position: [-w / 2 - t / 2, hgt / 2, 0], material: mat },
      h('boxGeometry', { args: [t, hgt, d] })),
    h('mesh', { position: [w / 2 + t / 2, hgt / 2, 0], material: mat },
      h('boxGeometry', { args: [t, hgt, d] }))
  );
}

function SceneContent(props) {
  var layout = props.layout, selectedId = props.selectedId, selectedLevel = props.selectedLevel, onPick = props.onPick;
  var b = useMemo(function () { return boundsOf(layout); }, [layout]);
  var racks = (layout && layout.racks) || [];
  var zones = (layout && layout.zones) || [];
  var room = layout && layout.room;
  var rw = room ? room.w : Math.max(b.width, 8);
  var rd = room ? room.d : Math.max(b.depth, 6);

  var zoneNodes = useMemo(function () {
    return zones.map(function (z, i) {
      return h(ZonePad, { key: z.key || z.name || i, zone: z });
    });
  }, [zones]);

  var rackNodes = useMemo(function () {
    return racks.map(function (r) {
      return h(RackMesh, {
        key: r.id, rack: r, selectedId: selectedId, selectedLevel: selectedLevel, onPick: onPick,
      });
    });
  }, [racks, selectedId, selectedLevel, onPick]);

  return h(React.Fragment, null,
    h('ambientLight', { intensity: 0.7 }),
    h('directionalLight', {
      position: [8, 14, 6], intensity: 0.95, castShadow: true,
      'shadow-mapSize-width': 1024,
      'shadow-mapSize-height': 1024,
      'shadow-camera-left': -12,
      'shadow-camera-right': 12,
      'shadow-camera-top': 12,
      'shadow-camera-bottom': -12,
      'shadow-bias': -0.0004,
    }),
    h('mesh', { rotation: [-Math.PI / 2, 0, 0], position: [0, -0.04, 0], material: MAT.ground },
      h('planeGeometry', { args: [36, 36] })
    ),
    h('mesh', { position: [0, 0.02, 0], receiveShadow: true, material: MAT.floor },
      h('boxGeometry', { args: [rw + 0.48, 0.04, rd + 0.48] })
    ),
    /* 房间外轮廓（对齐平面图 240 砖墙） */
    h(RoomWalls, { w: rw, d: rd }),
    h('gridHelper', {
      args: [Math.max(rw, rd) + 1, 12, C.grid, C.grid],
      position: [0, 0.045, 0],
    }),
    zoneNodes,
    rackNodes,
    h('mesh', {
      rotation: [-Math.PI / 2, 0, 0], position: [0, -0.03, 0],
      material: MAT.inv,
      onClick: function () { if (onPick) onPick(null, null); },
    },
      h('planeGeometry', { args: [28, 28] })
    )
  );
}

var controlsRef = null, cameraRef = null, lastLayout = null, navMode = 'rotate';

function CameraRig(props) {
  var layout = props.layout, autoRotate = props.autoRotate;
  var b = useMemo(function () { return boundsOf(layout); }, [layout]);
  var three = useThree();
  cameraRef = three.camera;
  lastLayout = layout;

  useEffect(function () {
    applyView('reset');
    invalidate();
  }, [layout]);

  /* demand 模式下轨道阻尼需要持续 invalidate */
  useFrame(function () {
    if (controlsRef && controlsRef.enabled) {
      if (controlsRef.update) controlsRef.update();
    }
  });

  return h(OrbitControls, {
    ref: function (c) {
      controlsRef = c;
      if (c) {
        c.addEventListener('change', function () { invalidate(); });
        c.addEventListener('start', function () { invalidate(); });
      }
    },
    makeDefault: true,
    enableDamping: true,
    dampingFactor: 0.12,
    minDistance: 2.5,
    maxDistance: 28,
    minPolarAngle: 0.2,
    maxPolarAngle: Math.PI / 2.12,
    enablePan: true,
    panSpeed: 1.1,
    screenSpacePanning: true,
    zoomSpeed: 1.0,
    rotateSpeed: 0.5,
    autoRotate: !!autoRotate,
    autoRotateSpeed: 0.35,
    target: [b.centerX, 0.55, b.centerZ],
    mouseButtons: {
      LEFT: navMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: navMode === 'pan' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
    },
  });
}

function applyView(mode) {
  if (!controlsRef || !cameraRef || !lastLayout) return;
  var b = boundsOf(lastLayout);
  var dist = Math.max(b.width, b.depth) * (mode === 'top' ? 1.05 : 1.25);
  if (mode === 'top') cameraRef.position.set(b.centerX, dist * 1.4, b.centerZ + 0.02);
  else cameraRef.position.set(b.centerX + dist * 0.85, dist * 0.68, b.centerZ + dist * 0.6);
  controlsRef.target.set(b.centerX, 0.55, b.centerZ);
  controlsRef.update();
  invalidate();
}

function ParkApp(props) {
  var dprMax = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1.25;
  return h(Canvas, {
    shadows: true,
    dpr: [1, dprMax],
    frameloop: props.autoRotate ? 'always' : 'demand',
    performance: { min: 0.5 },
    camera: { position: [7, 5.8, 6.2], fov: 40, near: 0.15, far: 120 },
    gl: {
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    },
    style: { width: '100%', height: '100%', display: 'block', touchAction: 'none' },
    onCreated: function (st) {
      st.gl.setClearColor(C.bg, 1);
      st.gl.shadowMap.enabled = true;
      st.gl.shadowMap.type = THREE.PCFShadowMap; /* 比 Soft 更省 */
    },
  },
    h(Suspense, { fallback: null },
      h(SceneContent, {
        layout: props.layout,
        selectedId: props.selectedId,
        selectedLevel: props.selectedLevel,
        onPick: props.onPick,
      }),
      h(CameraRig, { layout: props.layout, autoRotate: props.autoRotate })
    )
  );
}

function createPark3D() {
  var root = null, containerEl = null, lastProps = null;
  return {
    mount: function (container, props) {
      if (!container) return;
      containerEl = container;
      var layer = document.getElementById('parkLabelLayer');
      if (layer) layer.innerHTML = '';
      var hold = container.querySelector('[data-park3d-root]');
      if (!hold) {
        hold = document.createElement('div');
        hold.setAttribute('data-park3d-root', '1');
        hold.style.cssText = 'position:absolute;inset:0;z-index:0;';
        container.appendChild(hold);
      }
      if (!root) root = createRoot(hold);
      lastProps = props || {};
      root.render(h(ParkApp, lastProps));
    },
    update: function (props) {
      if (!root) return;
      lastProps = props || lastProps || {};
      root.render(h(ParkApp, lastProps));
      /* demand 模式：选中变化后手动刷一帧 */
      try { invalidate(); } catch (e) {}
    },
    setView: function (mode) { applyView(mode || 'reset'); },
    setNavMode: function (mode) {
      navMode = mode === 'pan' ? 'pan' : 'rotate';
      if (controlsRef) {
        controlsRef.mouseButtons = {
          LEFT: navMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: navMode === 'pan' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
        };
        invalidate();
      }
    },
    getNavMode: function () { return navMode; },
    refit: function () { applyView('fit'); },
    isOffPark: function () {
      if (!controlsRef || !cameraRef || !lastLayout) return false;
      var b = boundsOf(lastLayout), p = cameraRef.position;
      var margin = Math.max(b.width, b.depth) * 1.9;
      return p.x < b.minX - margin || p.x > b.maxX + margin ||
        p.z < b.minZ - margin || p.z > b.maxZ + margin;
    },
    getView: function () {
      if (!cameraRef || !controlsRef) return null;
      return { position: cameraRef.position.toArray(), target: controlsRef.target.toArray() };
    },
    unmount: function () {
      try { if (root) root.unmount(); } catch (e) {}
      root = null; controlsRef = null; cameraRef = null; lastLayout = null; lastProps = null;
      if (containerEl) {
        var hold = containerEl.querySelector('[data-park3d-root]');
        if (hold) hold.remove();
      }
      containerEl = null;
    },
  };
}

var api = { init: function () { return Promise.resolve(createPark3D()); } };
window.Park3D = api;
export default api;
