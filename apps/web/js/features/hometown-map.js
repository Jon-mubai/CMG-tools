/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/**
 * HometownMap — 基于卫星图的 Three.js 三维场景
 * 贴图: assets/hometown/satellite.png
 * 区域: 河南省信阳市商城县李集乡杨畈村古楼（示意建模）
 */
(function (global) {
  'use strict';
  var renderer, scene, camera, controls, animId = 0, mounted = false, paused = false;
  var rootGroup = null, labelLayer = null, container = null;
  var TEX_URL = './assets/hometown/satellite.png';

  function ensureTHREE() { return global.THREE || null; }

  function SimpleOrbit(cam, dom) {
    var scope = this;
    this.object = cam;
    this.domElement = dom;
    this.target = new THREE.Vector3(0, 0, 0);
    this.minDistance = 6;
    this.maxDistance = 90;
    var spherical = new THREE.Spherical();
    var sphericalDelta = new THREE.Spherical();
    var panOffset = new THREE.Vector3();
    var scale = 1;
    var state = -1;
    var rotateStart = new THREE.Vector2();
    var panStart = new THREE.Vector2();

    function update() {
      var offset = new THREE.Vector3().copy(scope.object.position).sub(scope.target);
      spherical.setFromVector3(offset);
      spherical.theta += sphericalDelta.theta;
      spherical.phi += sphericalDelta.phi;
      spherical.phi = Math.max(0.08, Math.min(Math.PI / 2.02, spherical.phi));
      spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius * scale));
      scope.target.add(panOffset);
      offset.setFromSpherical(spherical);
      scope.object.position.copy(scope.target).add(offset);
      scope.object.lookAt(scope.target);
      sphericalDelta.set(0, 0, 0);
      panOffset.set(0, 0, 0);
      scale = 1;
    }
    this.update = update;

    function onDown(e) {
      if (e.button === 0) { state = 0; rotateStart.set(e.clientX, e.clientY); }
      else if (e.button === 1 || e.button === 2) { state = 1; panStart.set(e.clientX, e.clientY); }
      e.preventDefault();
    }
    function onMove(e) {
      if (state === 0) {
        var dx = e.clientX - rotateStart.x, dy = e.clientY - rotateStart.y;
        rotateStart.set(e.clientX, e.clientY);
        sphericalDelta.theta -= 2 * Math.PI * dx / dom.clientWidth * 0.55;
        sphericalDelta.phi -= 2 * Math.PI * dy / dom.clientHeight * 0.4;
      } else if (state === 1) {
        var px = e.clientX - panStart.x, py = e.clientY - panStart.y;
        panStart.set(e.clientX, e.clientY);
        var dist = scope.object.position.distanceTo(scope.target);
        var panX = 2 * dist * px / dom.clientHeight;
        var panY = 2 * dist * py / dom.clientHeight;
        var right = new THREE.Vector3().setFromMatrixColumn(scope.object.matrix, 0);
        panOffset.add(right.multiplyScalar(-panX));
        panOffset.add(new THREE.Vector3(0, 1, 0).multiplyScalar(panY));
      }
    }
    function onUp() { state = -1; }
    function onWheel(e) {
      e.preventDefault();
      scale *= e.deltaY > 0 ? 1.09 : 0.91;
    }
    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    update();
  }

  /* 卫星图 UV 大致对应：中心=村落，左侧竖路，下方十字路口 */
  function addBuilding(group, x, z, w, d, h, roofColor, wallColor) {
    var THREE = ensureTHREE();
    var wall = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: wallColor || 0xd4c4a8, roughness: 0.88 })
    );
    wall.position.set(x, h / 2 + 0.02, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    var roof = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.06, Math.max(0.12, h * 0.12), d * 1.06),
      new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.7, metalness: 0.05 })
    );
    roof.position.set(x, h + 0.08, z);
    roof.castShadow = true;
    group.add(roof);
  }

  function addTree(group, x, z, s) {
    var THREE = ensureTHREE();
    s = s || 1;
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06 * s, 0.09 * s, 0.5 * s, 6),
      new THREE.MeshStandardMaterial({ color: 0x5c4033 })
    );
    trunk.position.set(x, 0.25 * s, z);
    group.add(trunk);
    var leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.35 * s, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.95 })
    );
    leaf.position.set(x, 0.65 * s, z);
    leaf.castShadow = true;
    group.add(leaf);
  }

  function buildVillage(group) {
    /* 依据卫星图：中心建筑群，红顶为主，夹杂灰/白顶；外围田地由贴图表现 */
    var R = 0xb4533c;   // 红瓦
    var R2 = 0xc45c3e;
    var G = 0x8a8f8a;   // 灰顶
    var W = 0xe8e6e1;   // 浅色顶
    var wall = 0xcbb89a;

    // 北侧较大红顶建筑组（图中上方）
    addBuilding(group, 1.8, -3.2, 2.4, 1.6, 1.1, R, wall);
    addBuilding(group, 3.6, -2.8, 1.5, 1.2, 0.95, R2, wall);
    addBuilding(group, 0.6, -2.4, 1.2, 1.0, 0.85, G, wall);

    // 中部主聚落
    addBuilding(group, -0.4, -0.2, 1.8, 1.4, 1.05, R, wall);
    addBuilding(group, 1.5, 0.3, 1.6, 1.3, 1.0, R2, wall);
    addBuilding(group, 3.0, 0.1, 1.3, 1.1, 0.9, W, 0xd0d0d0);
    addBuilding(group, 0.2, 1.4, 1.4, 1.2, 0.95, R, wall);
    addBuilding(group, 1.8, 1.8, 1.2, 1.0, 0.85, G, wall);
    addBuilding(group, -1.6, 0.8, 1.1, 0.95, 0.8, R2, wall);
    addBuilding(group, 2.6, 2.2, 1.0, 0.9, 0.75, R, wall);
    addBuilding(group, -0.8, 2.4, 1.3, 1.0, 0.88, G, wall);
    addBuilding(group, 0.9, -1.0, 1.0, 0.85, 0.7, W, wall);

    // 西侧零星建筑
    addBuilding(group, -3.2, -1.5, 1.2, 1.0, 0.8, G, wall);
    addBuilding(group, -4.0, 0.2, 1.0, 0.9, 0.7, R2, wall);

    // 树木环村
    var trees = [
      [-2.5, -3.5], [-1.2, -3.8], [4.5, -3.0], [5.0, -1.5], [4.8, 1.0],
      [4.2, 2.8], [2.0, 3.5], [-0.5, 3.6], [-2.8, 2.5], [-3.8, -2.5],
      [-1.0, 0.0], [3.5, -1.2], [5.2, 0.2], [-4.5, 1.5], [1.0, 3.2]
    ];
    for (var i = 0; i < trees.length; i++) {
      addTree(group, trees[i][0], trees[i][1], 0.85 + (i % 3) * 0.15);
    }
  }

  function buildGround(tex) {
    var THREE = ensureTHREE();
    var size = 36;
    var geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    var mat;
    if (tex) {
      tex.colorSpace = THREE.SRGBColorSpace || tex.colorSpace;
      tex.anisotropy = 8;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.95,
        metalness: 0.0
      });
    } else {
      mat = new THREE.MeshStandardMaterial({ color: 0x4a6b45, roughness: 1 });
    }
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.position.y = 0;
    return mesh;
  }

  /* 贴合卫星图的土路：左侧竖路 + 中部环村路 */
  function buildRoads(group) {
    var THREE = ensureTHREE();
    var mat = new THREE.MeshStandardMaterial({
      color: 0xc4b89a,
      roughness: 1,
      metalness: 0
    });
    // 左侧南北向大路（图中最显眼）
    var main = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 34), mat);
    main.position.set(-10.5, 0.03, 0);
    main.receiveShadow = true;
    group.add(main);
    // 下方横向支路
    var cross = new THREE.Mesh(new THREE.BoxGeometry(22, 0.04, 0.85), mat);
    cross.position.set(-2, 0.03, 8.5);
    group.add(cross);
    // 入村土路（从左路通向村落）
    var spur = new THREE.Mesh(new THREE.BoxGeometry(10, 0.035, 0.7), mat);
    spur.position.set(-5.5, 0.03, -1.2);
    spur.rotation.y = -0.25;
    group.add(spur);
    // 村内环路示意
    var loop = new THREE.Mesh(new THREE.BoxGeometry(7, 0.03, 0.55), mat);
    loop.position.set(1.0, 0.025, 2.6);
    group.add(loop);
    var loop2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 5), mat);
    loop2.position.set(-1.6, 0.025, 0.2);
    group.add(loop2);
  }

  function placeLabel(text, world, color) {
    if (!labelLayer) return;
    var el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'position:absolute;transform:translate(-50%,-130%);padding:4px 8px;border-radius:8px;font-size:12px;font-weight:600;white-space:nowrap;pointer-events:none;background:rgba(15,23,42,.85);color:' + color + ';border:1px solid rgba(255,255,255,.14);';
    labelLayer.appendChild(el);
    el._wp = world;
  }

  function updateLabels() {
    if (!labelLayer || !camera || !renderer) return;
    var w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    var kids = labelLayer.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (!el._wp) continue;
      var v = el._wp.clone().project(camera);
      if (v.z > 1) { el.style.display = 'none'; continue; }
      el.style.display = 'block';
      el.style.left = ((v.x * 0.5 + 0.5) * w) + 'px';
      el.style.top = ((-v.y * 0.5 + 0.5) * h) + 'px';
    }
  }

  function buildScene(tex) {
    var THREE = ensureTHREE();
    rootGroup = new THREE.Group();
    scene.add(rootGroup);
    rootGroup.add(buildGround(tex));
    buildRoads(rootGroup);
    buildVillage(rootGroup);

    placeLabel('古楼 / 杨畈村', new THREE.Vector3(1.2, 2.2, 0.2), '#fde68a');
    placeLabel('进村道路', new THREE.Vector3(-6, 1.2, -1.2), '#e7e5e4');
    placeLabel('田间道路', new THREE.Vector3(-10.5, 1.0, 6), '#d6d3d1');
  }

  function animate() {
    if (paused) { animId = 0; return; }
    animId = requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
      updateLabels();
    }
  }

  function resize() {
    if (!container || !renderer || !camera) return;
    var w = container.clientWidth || 800;
    var h = container.clientHeight || 480;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  function mount() {
    var THREE = ensureTHREE();
    container = document.getElementById('hometownMapCanvas');
    if (!container) return;
    if (!THREE) {
      container.innerHTML = '<div style="color:#fff;padding:24px;">Three.js 未加载</div>';
      return;
    }
    paused = false;
    if (mounted) {
      resize();
      if (!animId) animate();
      return;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9bb7c9);
    scene.fog = new THREE.Fog(0x9bb7c9, 40, 95);
    camera = new THREE.PerspectiveCamera(42, 1, 0.15, 200);
    // 接近卫星俯视的初始角度
    camera.position.set(8, 22, 18);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (renderer.outputColorSpace !== undefined && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    labelLayer = document.createElement('div');
    labelLayer.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1;';
    container.appendChild(labelLayer);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    scene.add(new THREE.HemisphereLight(0xddeeff, 0x5a6b4a, 0.45));
    var dir = new THREE.DirectionalLight(0xfff6e8, 1.05);
    dir.position.set(18, 30, 12);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -25;
    dir.shadow.camera.right = 25;
    dir.shadow.camera.top = 25;
    dir.shadow.camera.bottom = -25;
    scene.add(dir);

    function finish(tex) {
      buildScene(tex || null);
      controls = new SimpleOrbit(camera, renderer.domElement);
      controls.target.set(0.5, 0.2, 0.2);
      controls.update();
      var btnR = document.getElementById('hometownBtnReset');
      var btnT = document.getElementById('hometownBtnTop');
      if (btnR && !btnR.__ht2) {
        btnR.__ht2 = true;
        btnR.addEventListener('click', function () {
          camera.position.set(8, 22, 18);
          controls.target.set(0.5, 0.2, 0.2);
        });
      }
      if (btnT && !btnT.__ht2) {
        btnT.__ht2 = true;
        btnT.addEventListener('click', function () {
          camera.position.set(0.5, 32, 0.2);
          controls.target.set(0.5, 0, 0.2);
        });
      }
      window.addEventListener('resize', resize);
      mounted = true;
      resize();
      animate();
    }

    var loader = new THREE.TextureLoader();
    loader.load(
      TEX_URL,
      function (tex) { finish(tex); },
      undefined,
      function () {
        console.warn('[HometownMap] 卫星贴图加载失败，使用纯色地面', TEX_URL);
        finish(null);
      }
    );
  }

  function pause() {
    paused = true;
    if (animId) { cancelAnimationFrame(animId); animId = 0; }
  }

  global.HometownMap = {
    mount: mount,
    pause: pause,
    remount: function () {
      mounted = false;
      paused = false;
      if (animId) { cancelAnimationFrame(animId); animId = 0; }
      if (renderer) {
        try { renderer.dispose(); } catch (e) {}
      }
      renderer = scene = camera = controls = rootGroup = null;
      mount();
    }
  };
})(typeof window !== 'undefined' ? window : this);
