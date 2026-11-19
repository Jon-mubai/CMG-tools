/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/**
 * Park3D — 纯 Three.js 本地版（零 CDN / 零 React）
 * 优化：半球光+柔阴影+雾效+Phong 材质+色调映射
 * 依赖：同目录 vendor/three.min.js（已内置）
 * API 与旧 R3F 版兼容：init → { mount, update, setView, setNavMode, getNavMode, refit, isOffPark, getView, unmount }
 */
(function (global) {
  'use strict';
  if (!global.THREE) {
    console.error('[Park3D] THREE 未加载，请先引入 vendor/three.min.js');
    return;
  }
  var THREE = global.THREE;

  /* ---------- 精简 OrbitControls（本地，不依赖 examples） ---------- */
  function OrbitControls(object, domElement) {
    var scope = this;
    this.object = object;
    this.domElement = domElement;
    this.enabled = true;
    this.target = new THREE.Vector3();
    this.minDistance = 1;
    this.maxDistance = 40;
    this.minPolarAngle = 0;
    this.maxPolarAngle = Math.PI;
    this.enableDamping = true;
    this.dampingFactor = 0.12;
    this.enableZoom = true;
    this.zoomSpeed = 1.0;
    this.enableRotate = true;
    this.rotateSpeed = 0.5;
    this.enablePan = true;
    this.panSpeed = 1.1;
    this.autoRotate = false;
    this.autoRotateSpeed = 0.4;
    this.screenSpacePanning = true;
    this.mouseButtons = { LEFT: 0, MIDDLE: 1, RIGHT: 2 }; // 0=ROTATE 1=DOLLY 2=PAN

    var STATE = { NONE: -1, ROTATE: 0, DOLLY: 1, PAN: 2 };
    var state = STATE.NONE;
    var spherical = new THREE.Spherical();
    var sphericalDelta = new THREE.Spherical();
    var panOffset = new THREE.Vector3();
    var scale = 1;
    var rotateStart = new THREE.Vector2();
    var rotateEnd = new THREE.Vector2();
    var panStart = new THREE.Vector2();
    var panEnd = new THREE.Vector2();
    var dollyStart = new THREE.Vector2();
    var dollyEnd = new THREE.Vector2();

    function getAutoRotationAngle() {
      return ((2 * Math.PI) / 60 / 60) * scope.autoRotateSpeed;
    }
    function rotateLeft(angle) { sphericalDelta.theta -= angle; }
    function rotateUp(angle) { sphericalDelta.phi -= angle; }
    function panLeft(distance, objectMatrix) {
      var v = new THREE.Vector3();
      v.setFromMatrixColumn(objectMatrix, 0);
      v.multiplyScalar(-distance);
      panOffset.add(v);
    }
    function panUp(distance, objectMatrix) {
      var v = new THREE.Vector3();
      if (scope.screenSpacePanning) {
        v.setFromMatrixColumn(objectMatrix, 1);
      } else {
        v.setFromMatrixColumn(objectMatrix, 0);
        v.crossVectors(scope.object.up, v);
      }
      v.multiplyScalar(distance);
      panOffset.add(v);
    }
    function pan(deltaX, deltaY) {
      var element = scope.domElement;
      var position = scope.object.position;
      var offset = position.clone().sub(scope.target);
      var targetDistance = offset.length();
      targetDistance *= Math.tan(((scope.object.fov / 2) * Math.PI) / 180);
      panLeft((2 * deltaX * targetDistance) / element.clientHeight, scope.object.matrix);
      panUp((2 * deltaY * targetDistance) / element.clientHeight, scope.object.matrix);
    }
    function dollyIn(dollyScale) { scale /= dollyScale; }
    function dollyOut(dollyScale) { scale *= dollyScale; }
    function getZoomScale() { return Math.pow(0.95, scope.zoomSpeed); }

    function handleMouseDownRotate(e) { rotateStart.set(e.clientX, e.clientY); }
    function handleMouseDownDolly(e) { dollyStart.set(e.clientX, e.clientY); }
    function handleMouseDownPan(e) { panStart.set(e.clientX, e.clientY); }
    function handleMouseMoveRotate(e) {
      rotateEnd.set(e.clientX, e.clientY);
      var el = scope.domElement;
      rotateLeft(((2 * Math.PI * (rotateEnd.x - rotateStart.x)) / el.clientHeight) * scope.rotateSpeed);
      rotateUp(((2 * Math.PI * (rotateEnd.y - rotateStart.y)) / el.clientHeight) * scope.rotateSpeed);
      rotateStart.copy(rotateEnd);
      scope.update();
    }
    function handleMouseMoveDolly(e) {
      dollyEnd.set(e.clientX, e.clientY);
      if (dollyEnd.y > dollyStart.y) dollyIn(getZoomScale());
      else if (dollyEnd.y < dollyStart.y) dollyOut(getZoomScale());
      dollyStart.copy(dollyEnd);
      scope.update();
    }
    function handleMouseMovePan(e) {
      panEnd.set(e.clientX, e.clientY);
      pan(panEnd.x - panStart.x, panEnd.y - panStart.y);
      panStart.copy(panEnd);
      scope.update();
    }
    function handleMouseWheel(e) {
      if (e.deltaY < 0) dollyOut(getZoomScale());
      else if (e.deltaY > 0) dollyIn(getZoomScale());
      scope.update();
    }

    function onPointerDown(e) {
      if (!scope.enabled) return;
      scope.domElement.setPointerCapture(e.pointerId);
      if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
        if (!scope.enableZoom) return;
        handleMouseDownDolly(e); state = STATE.DOLLY;
      } else if (e.button === 2 || (e.button === 0 && (scope.mouseButtons.LEFT === 2))) {
        if (!scope.enablePan) return;
        handleMouseDownPan(e); state = STATE.PAN;
      } else if (e.button === 0) {
        if (scope.mouseButtons.LEFT === 2) {
          if (!scope.enablePan) return;
          handleMouseDownPan(e); state = STATE.PAN;
        } else {
          if (!scope.enableRotate) return;
          handleMouseDownRotate(e); state = STATE.ROTATE;
        }
      }
    }
    function onPointerMove(e) {
      if (!scope.enabled) return;
      if (state === STATE.ROTATE) handleMouseMoveRotate(e);
      else if (state === STATE.DOLLY) handleMouseMoveDolly(e);
      else if (state === STATE.PAN) handleMouseMovePan(e);
    }
    function onPointerUp(e) {
      state = STATE.NONE;
      try { scope.domElement.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    function onWheel(e) {
      if (!scope.enabled || !scope.enableZoom) return;
      e.preventDefault();
      handleMouseWheel(e);
    }
    function onContextMenu(e) { e.preventDefault(); }

    this.update = function () {
      var offset = new THREE.Vector3();
      var quat = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0, 1, 0));
      var quatInverse = quat.clone().invert();
      var lastPosition = new THREE.Vector3();
      var lastQuaternion = new THREE.Quaternion();
      return function update() {
        var position = scope.object.position;
        offset.copy(position).sub(scope.target);
        offset.applyQuaternion(quat);
        spherical.setFromVector3(offset);
        if (scope.autoRotate && state === STATE.NONE) {
          rotateLeft(getAutoRotationAngle());
        }
        spherical.theta += sphericalDelta.theta;
        spherical.phi += sphericalDelta.phi;
        spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));
        spherical.phi = Math.max(0.000001, Math.min(Math.PI - 0.000001, spherical.phi));
        spherical.radius *= scale;
        spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));
        scope.target.add(panOffset);
        offset.setFromSpherical(spherical);
        offset.applyQuaternion(quatInverse);
        position.copy(scope.target).add(offset);
        scope.object.lookAt(scope.target);
        if (scope.enableDamping) {
          sphericalDelta.theta *= 1 - scope.dampingFactor;
          sphericalDelta.phi *= 1 - scope.dampingFactor;
          panOffset.multiplyScalar(1 - scope.dampingFactor);
        } else {
          sphericalDelta.set(0, 0, 0);
          panOffset.set(0, 0, 0);
        }
        scale = 1;
        if (lastPosition.distanceToSquared(scope.object.position) > 1e-10 ||
            8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > 1e-10) {
          lastPosition.copy(scope.object.position);
          lastQuaternion.copy(scope.object.quaternion);
          return true;
        }
        return false;
      };
    }();

    this.dispose = function () {
      scope.domElement.removeEventListener('pointerdown', onPointerDown);
      scope.domElement.removeEventListener('pointermove', onPointerMove);
      scope.domElement.removeEventListener('pointerup', onPointerUp);
      scope.domElement.removeEventListener('wheel', onWheel);
      scope.domElement.removeEventListener('contextmenu', onContextMenu);
    };

    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointermove', onPointerMove);
    domElement.addEventListener('pointerup', onPointerUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });
    domElement.addEventListener('contextmenu', onContextMenu);
    this.update();
  }

  /* ---------- 色板 ---------- */
  var C = {
    frame: 0x1e293b, shelf: 0xf1f5f9, floor: 0xf8fafc, bg: 0xf1f5f9,
    high: 0x22c55e, mid: 0xeab308, low: 0xef4444, empty: 0x94a3b8,
    wall: 0x64748b, base: 0xcbd5e1, sel: 0x3b82f6
  };
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
      var r = racks[i], w = (r.rw || 1) * 0.55, d = (r.rd || 0.5) * 0.55;
      var x = r.wx || 0, z = r.wz || 0;
      if (x - w < minX) minX = x - w;
      if (x + w > maxX) maxX = x + w;
      if (z - d < minZ) minZ = z - d;
      if (z + d > maxZ) maxZ = z + d;
    }
    if (!isFinite(minX)) { minX = -4; maxX = 4; minZ = -3; maxZ = 3; }
    var room = layout && layout.room;
    if (room) {
      minX = Math.min(minX, -room.w / 2); maxX = Math.max(maxX, room.w / 2);
      minZ = Math.min(minZ, -room.d / 2); maxZ = Math.max(maxZ, room.d / 2);
    }
    var pad = 1.2;
    return {
      minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad,
      centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2,
      width: maxX - minX + pad * 2, depth: maxZ - minZ + pad * 2
    };
  }

  function createPark3D() {
    var renderer, scene, camera, controls, rootGroup, animId = 0;
    var containerEl = null, labelLayer = null;
    var currentLayout = null, selectedId = null, selectedLevel = null, onPick = null;
    var autoRotate = false, navMode = 'rotate';
    var raycaster = new THREE.Raycaster();
    var pointer = new THREE.Vector2();
    var pickables = [];
    var matCache = {};
    function mat(hex, opts) {
      opts = opts || {};
      var key = String(hex) + (opts.transparent ? '_t' : '') + (opts.emissive || '');
      if (!matCache[key]) {
        matCache[key] = new THREE.MeshPhongMaterial({
          color: hex,
          shininess: opts.shininess != null ? opts.shininess : 18,
          specular: 0x222222,
          transparent: !!opts.transparent,
          opacity: opts.opacity != null ? opts.opacity : 1,
          emissive: opts.emissive || 0x000000,
          depthWrite: opts.depthWrite !== false
        });
      }
      return matCache[key];
    }

    function clearGroup(g) {
      while (g.children.length) {
        var ch = g.children[0];
        g.remove(ch);
        if (ch.geometry) ch.geometry.dispose();
        /* 材质走缓存，不在此 dispose，避免跨次 build 失效 */
      }
      pickables = [];
    }

    function buildScene(layout) {
      clearGroup(rootGroup);
      pickables = [];
      currentLayout = layout;
      var racks = (layout && layout.racks) || [];
      var zones = (layout && layout.zones) || [];
      var room = layout && layout.room;
      var rw = room ? room.w : 7.2, rd = room ? room.d : 5.0;
      var b = boundsOf(layout);

      // ground
      var ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat(C.bg));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.04; rootGroup.add(ground);
      var floor = new THREE.Mesh(new THREE.BoxGeometry(rw + 0.48, 0.04, rd + 0.48), mat(C.floor));
      floor.position.y = 0.02; floor.receiveShadow = true; rootGroup.add(floor);
      // walls
      var wt = 0.12, wh = 0.55;
      [[0, -rd / 2 - wt / 2, rw + wt * 2, wt], [0, rd / 2 + wt / 2, rw + wt * 2, wt]].forEach(function (w) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(w[2], wh, w[3]), mat(C.wall));
        m.position.set(w[0], wh / 2, w[1]); rootGroup.add(m);
      });
      [[-rw / 2 - wt / 2, 0, wt, rd], [rw / 2 + wt / 2, 0, wt, rd]].forEach(function (w) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(w[2], wh, w[3]), mat(C.wall));
        m.position.set(w[0], wh / 2, w[1]); rootGroup.add(m);
      });
      var grid = new THREE.GridHelper(Math.max(rw, rd) + 1, 12, 0xcbd5e1, 0xcbd5e1);
      grid.position.y = 0.045; rootGroup.add(grid);

      zones.forEach(function (zone) {
        if (!zone) return;
        var x = typeof zone.originX === 'number' ? zone.originX : (zone.pos ? zone.pos[0] : 0);
        var z = typeof zone.originZ === 'number' ? zone.originZ : (zone.pos ? zone.pos[1] : 0);
        if (zone.kind === 'wall') {
          var ww = zone.pw || 0.24, dz = zone.pd || 1.3;
          var wm = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.7, dz), mat(C.wall));
          wm.position.set(x, 0.35, z); rootGroup.add(wm);
          return;
        }
        if (!zone.noRack && zone.kind !== 'aisle' && zone.kind !== 'door') return;
        var pw = zone.spanX || zone.pw || 1.5, pd = zone.spanZ || zone.pd || 1.2;
        var zm = new THREE.Mesh(
          new THREE.PlaneGeometry(pw, pd),
          new THREE.MeshBasicMaterial({ color: zone.kind === 'door' ? 0xbbf7d0 : 0xe2e8f0, transparent: true, opacity: 0.4, depthWrite: false })
        );
        zm.rotation.x = -Math.PI / 2; zm.position.set(x, 0.012, z); rootGroup.add(zm);
      });

      racks.forEach(function (rack) {
        var levels = rack.levels || [];
        var n = Math.max(1, levels.length);
        var vertical = rack.orientation === 'v';
        var w = Math.max(0.4, vertical ? (rack.rd || 0.45) : (rack.rw || 1));
        var d = Math.max(0.3, vertical ? (rack.rw || 1) : (rack.rd || 0.45));
        var levelGap = 0.36, baseY = 0.14, post = 0.048;
        var topY = baseY + (n - 1) * levelGap + 0.04;
        var postH = topY + 0.02;
        var selected = selectedId === rack.id;
        var g = new THREE.Group();
        g.position.set(rack.wx || 0, 0, rack.wz || 0);
        g.userData.rack = rack;

        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c, i) {
          var pm = new THREE.Mesh(new THREE.BoxGeometry(post, postH, post), mat(selected ? 0x0f172a : C.frame));
          pm.position.set((w / 2 - post * 0.55) * c[0], postH / 2, (d / 2 - post * 0.55) * c[1]);
          if (i < 2) pm.castShadow = true;
          g.add(pm);
        });
        var base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.07, d + 0.12), mat(selected ? 0x93c5fd : C.base));
        base.position.y = 0.035; base.receiveShadow = true;
        base.userData = { rack: rack, level: null };
        g.add(base); pickables.push(base);

        levels.forEach(function (lv, li) {
          var y = baseY + li * levelGap;
          var isSel = selected && selectedLevel === lv.level;
          var rate = lv.capacity > 0 ? Math.min(1, (lv.stock || 0) / lv.capacity) : 0;
          var board = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.98, 0.04, d * 0.96),
            mat(isSel ? 0xbfdbfe : C.shelf)
          );
          board.position.y = y; board.receiveShadow = true;
          board.userData = { rack: rack, level: lv.level };
          g.add(board); pickables.push(board);

          var boxCount = rate > 0.02 ? Math.max(1, Math.min(3, Math.round(rate * 3))) : 0;
          var boxW = (w * 0.8) / Math.max(boxCount, 1) * 0.88;
          var gap = (w * 0.8 - boxW * boxCount) / (boxCount + 1);
          for (var bi = 0; bi < boxCount; bi++) {
            var bx = -w * 0.4 + gap + boxW / 2 + bi * (boxW + gap);
            var cargo = new THREE.Mesh(
              new THREE.BoxGeometry(boxW, 0.14, d * 0.5),
              mat(isSel ? 0x60a5fa : stockColor(rate))
            );
            cargo.position.set(bx, y + 0.09, 0);
            cargo.userData = { rack: rack, level: lv.level };
            g.add(cargo); pickables.push(cargo);
          }
        });
        rootGroup.add(g);
      });

      updateLabels();
    }

    function updateLabels() {
      if (!labelLayer || !camera || !containerEl) return;
      labelLayer.innerHTML = '';
      if (!currentLayout) return;
      var racks = currentLayout.racks || [];
      var rect = containerEl.getBoundingClientRect();
      racks.forEach(function (rack) {
        var levels = rack.levels || [];
        var n = Math.max(1, levels.length);
        var topY = 0.14 + (n - 1) * 0.36 + 0.3;
        var v = new THREE.Vector3(rack.wx || 0, topY, rack.wz || 0);
        v.project(camera);
        if (v.z > 1) return;
        var sx = (v.x * 0.5 + 0.5) * rect.width;
        var sy = (-v.y * 0.5 + 0.5) * rect.height;
        var el = document.createElement('div');
        var selected = selectedId === rack.id;
        el.textContent = rack.code || '';
        el.style.cssText = 'position:absolute;left:' + sx + 'px;top:' + sy + 'px;transform:translate(-50%,-100%);' +
          'padding:1px 7px;border-radius:5px;font:700 11px system-ui,sans-serif;white-space:nowrap;pointer-events:none;' +
          (selected
            ? 'background:rgba(37,99,235,0.95);color:#fff;'
            : 'background:rgba(255,255,255,0.92);color:#0f172a;border:1px solid rgba(15,23,42,0.12);');
        labelLayer.appendChild(el);

        if (selected && selectedLevel != null) {
          var lv = levels.filter(function (L) { return L.level === selectedLevel; })[0];
          if (lv) {
            var rate = lv.capacity > 0 ? lv.stock / lv.capacity : 0;
            var tip = document.createElement('div');
            tip.innerHTML = '<b>' + rack.code + ' · L' + lv.level + '</b><div style="font-weight:700;margin-top:2px">' +
              (lv.stock || 0) + '/' + (lv.capacity || 0) + '（' + Math.round(rate * 100) + '%）</div>';
            tip.style.cssText = 'position:absolute;left:' + sx + 'px;top:' + (sy - 22) + 'px;transform:translate(-50%,-100%);' +
              'padding:6px 10px;border-radius:8px;font:12px system-ui;background:rgba(255,255,255,0.96);' +
              'border:1px solid rgba(15,23,42,0.12);box-shadow:0 6px 18px rgba(15,23,42,0.12);pointer-events:none;white-space:nowrap;';
            labelLayer.appendChild(tip);
          }
        }
      });
    }

    function applyView(mode) {
      if (!camera || !controls || !currentLayout) return;
      var b = boundsOf(currentLayout);
      var dist = Math.max(b.width, b.depth) * (mode === 'top' ? 1.05 : 1.25);
      if (mode === 'top') camera.position.set(b.centerX, dist * 1.4, b.centerZ + 0.02);
      else camera.position.set(b.centerX + dist * 0.85, dist * 0.68, b.centerZ + dist * 0.6);
      controls.target.set(b.centerX, 0.55, b.centerZ);
      controls.update();
    }

    function onCanvasClick(e) {
      if (!renderer || !camera) return;
      var rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(pickables, false);
      if (hits.length && onPick) {
        var ud = hits[0].object.userData;
        onPick(ud.rack || null, ud.level != null ? ud.level : null);
      } else if (onPick) {
        onPick(null, null);
      }
    }

    function animate() {
      animId = requestAnimationFrame(animate);
      if (controls) {
        controls.autoRotate = !!autoRotate;
        controls.update();
      }
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
        updateLabels();
      }
    }

    function resize() {
      if (!containerEl || !renderer || !camera) return;
      var w = containerEl.clientWidth || 1, h = containerEl.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }

    return {
      mount: function (container, props) {
        if (!container) return;
        containerEl = container;
        props = props || {};
        var hold = container.querySelector('[data-park3d-root]');
        if (!hold) {
          hold = document.createElement('div');
          hold.setAttribute('data-park3d-root', '1');
          hold.style.cssText = 'position:absolute;inset:0;z-index:0;';
          container.appendChild(hold);
        }
        labelLayer = document.getElementById('parkLabelLayer');
        if (labelLayer) {
          labelLayer.innerHTML = '';
          labelLayer.style.pointerEvents = 'none';
        }
        if (!renderer) {
          scene = new THREE.Scene();
          scene.background = new THREE.Color(0xf1f5f9);
          scene.fog = new THREE.Fog(0xf1f5f9, 18, 48);
          camera = new THREE.PerspectiveCamera(42, 1, 0.12, 160);
          camera.position.set(7.2, 6.2, 6.6);
          renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            logarithmicDepthBuffer: false
          });
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;
          if (renderer.outputColorSpace !== undefined) {
            renderer.outputColorSpace = THREE.SRGBColorSpace || renderer.outputColorSpace;
          } else if (renderer.outputEncoding !== undefined && THREE.sRGBEncoding) {
            renderer.outputEncoding = THREE.sRGBEncoding;
          }
          if (renderer.toneMapping !== undefined) {
            renderer.toneMapping = THREE.ACESFilmicToneMapping || THREE.NoToneMapping;
            renderer.toneMappingExposure = 1.05;
          }
          hold.appendChild(renderer.domElement);
          renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;outline:none;';
          renderer.domElement.addEventListener('click', onCanvasClick);

          /* 分层光照：环境 + 半球 + 主方向光（柔阴影） */
          scene.add(new THREE.AmbientLight(0xffffff, 0.42));
          var hemi = new THREE.HemisphereLight(0xe2e8f0, 0x94a3b8, 0.55);
          hemi.position.set(0, 12, 0);
          scene.add(hemi);
          var dir = new THREE.DirectionalLight(0xfff7ed, 0.92);
          dir.position.set(9, 16, 7);
          dir.castShadow = true;
          dir.shadow.mapSize.set(1536, 1536);
          dir.shadow.bias = -0.00025;
          dir.shadow.normalBias = 0.02;
          dir.shadow.camera.near = 1;
          dir.shadow.camera.far = 40;
          dir.shadow.camera.left = -14;
          dir.shadow.camera.right = 14;
          dir.shadow.camera.top = 14;
          dir.shadow.camera.bottom = -14;
          scene.add(dir);
          var fill = new THREE.DirectionalLight(0xdbeafe, 0.28);
          fill.position.set(-6, 8, -4);
          scene.add(fill);

          rootGroup = new THREE.Group();
          scene.add(rootGroup);
          controls = new OrbitControls(camera, renderer.domElement);
          controls.enableDamping = true;
          controls.dampingFactor = 0.08;
          controls.minDistance = 2.2;
          controls.maxDistance = 32;
          controls.minPolarAngle = 0.18;
          controls.maxPolarAngle = Math.PI / 2.08;
          controls.target.set(0, 0.55, 0);
          controls.rotateSpeed = 0.55;
          controls.panSpeed = 1.05;
          controls.zoomSpeed = 1.05;

          window.addEventListener('resize', resize);
          animate();
        }
        selectedId = props.selectedId || null;
        selectedLevel = props.selectedLevel != null ? props.selectedLevel : null;
        onPick = props.onPick || null;
        autoRotate = !!props.autoRotate;
        buildScene(props.layout || { racks: [], zones: [] });
        resize();
        applyView('reset');
      },
      update: function (props) {
        if (!renderer) return;
        props = props || {};
        selectedId = props.selectedId || null;
        selectedLevel = props.selectedLevel != null ? props.selectedLevel : null;
        onPick = props.onPick || onPick;
        autoRotate = !!props.autoRotate;
        buildScene(props.layout || currentLayout || { racks: [], zones: [] });
        resize();
      },
      setView: function (mode) { applyView(mode || 'reset'); },
      setNavMode: function (mode) {
        navMode = mode === 'pan' ? 'pan' : 'rotate';
        if (controls) {
          controls.mouseButtons.LEFT = navMode === 'pan' ? 2 : 0;
        }
      },
      getNavMode: function () { return navMode; },
      refit: function () { applyView('fit'); },
      isOffPark: function () {
        if (!camera || !currentLayout) return false;
        var b = boundsOf(currentLayout), p = camera.position;
        var margin = Math.max(b.width, b.depth) * 1.9;
        return p.x < b.minX - margin || p.x > b.maxX + margin ||
          p.z < b.minZ - margin || p.z > b.maxZ + margin;
      },
      getView: function () {
        if (!camera || !controls) return null;
        return { position: camera.position.toArray(), target: controls.target.toArray() };
      },
      unmount: function () {
        if (animId) cancelAnimationFrame(animId);
        animId = 0;
        window.removeEventListener('resize', resize);
        if (controls) controls.dispose();
        if (renderer) {
          renderer.domElement.removeEventListener('click', onCanvasClick);
          renderer.dispose();
          if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        renderer = scene = camera = controls = rootGroup = null;
        if (containerEl) {
          var hold = containerEl.querySelector('[data-park3d-root]');
          if (hold) hold.remove();
        }
        containerEl = null; labelLayer = null; pickables = [];
      }
    };
  }

  var api = {
    init: function () {
      return Promise.resolve(createPark3D());
    }
  };
  global.Park3D = api;
})(typeof window !== 'undefined' ? window : this);
