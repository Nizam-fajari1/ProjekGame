(() => {
  const $ = (id) => document.getElementById(id);
  let s = 11;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const rr = (a, b) => a + rnd() * (b - a);
  const M = (c, o) =>
    new THREE.MeshStandardMaterial(
      Object.assign({ color: c, flatShading: true, roughness: 0.9 }, o),
    );
  const mesh = (g, m, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    return o;
  };

  // ---------- Renderer, langit, kabut, cahaya ----------
  const cvs = $("game");
  const renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const FOG = 0xf0b68a;
  scene.fog = new THREE.Fog(FOG, 30, 140);
  const sk = document.createElement("canvas");
  sk.width = 2;
  sk.height = 256;
  const sx = sk.getContext("2d"),
    gr = sx.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "#4a5fa8");
  gr.addColorStop(0.5, "#d98fa0");
  gr.addColorStop(0.8, "#f0b68a");
  gr.addColorStop(1, "#f0b68a");
  sx.fillStyle = gr;
  sx.fillRect(0, 0, 2, 256);
  scene.background = new THREE.CanvasTexture(sk);
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
  };
  addEventListener("resize", resize);
  resize();

  const hemi = new THREE.HemisphereLight(0xffd2b0, 0x3f6b3a, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb878, 1.25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, {
    left: -45,
    right: 45,
    top: 45,
    bottom: -45,
    near: 1,
    far: 160,
  });
  scene.add(sun, sun.target);
  const SUNDIR = new THREE.Vector3(55, 26, 28);
  const disc = new THREE.Mesh(
    new THREE.SphereGeometry(9, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe0a0, fog: false }),
  );
  scene.add(disc);

  // ---------- Terrain ----------
  const RZ = (x) => -16 + 4 * Math.sin(x * 0.08); // garis tengah sungai
  const H = (x, z) => {
    if (x > 400) return 0;
    const k = Math.min(1, Math.max(0, (Math.hypot(x, z) - 30) / 30)),
      d = Math.abs(z - RZ(x));
    const r =
      k *
        k *
        (Math.sin(x * 0.07) * 3 +
          Math.cos(z * 0.06) * 3 +
          Math.sin((x + z) * 0.15)) *
        Math.min(1, d / 9) -
      (d < 5 ? 1.3 * (1 - (d / 5) * (d / 5)) : 0);
    return Math.abs(x) < 1.4 && d < 6.2 ? Math.max(0.35, r) : r; // jalur jembatan
  };
  const gg = new THREE.PlaneGeometry(260, 260, 190, 190);
  gg.rotateX(-Math.PI / 2);
  const gp = gg.attributes.position,
    gc = [],
    c1 = new THREE.Color(0x5a9a43),
    c2 = new THREE.Color(0x88bb52);
  for (let i = 0; i < gp.count; i++) {
    gp.setY(i, H(gp.getX(i), gp.getZ(i)));
    gc.push(...c1.clone().lerp(c2, rnd()).toArray());
  }
  gg.setAttribute("color", new THREE.Float32BufferAttribute(gc, 3));
  gg.computeVertexNormals();
  const ground = new THREE.Mesh(gg, M(0xffffff, { vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- Objek dunia ----------
  const solids = [],
    segs = [],
    wins = [],
    chim = [],
    hlist = [],
    trees = []; // solids: [x, z, radius]
  const nearPath = (x, z) =>
    segs.some(([ax, az, bx, bz]) => {
      const dx = bx - ax,
        dz = bz - az,
        t = Math.max(
          0,
          Math.min(
            1,
            ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1),
          ),
        );
      return Math.hypot(x - ax - dx * t, z - az - dz * t) < 2.5;
    });
  const free = (x, z, r) =>
    Math.hypot(x, z) > 7 &&
    Math.abs(z - RZ(x)) > 7 &&
    !nearPath(x, z) &&
    solids.every((o) => Math.hypot(o[0] - x, o[1] - z) > o[2] + r);

  const stoneG = new THREE.CylinderGeometry(0.9, 1, 0.12, 7),
    stoneM = M(0xb89c74);
  function path(x, z, x0, z0) {
    x0 = x0 || 0;
    z0 = z0 || 0;
    segs.push([x0, z0, x, z]);
    const n = Math.max(1, Math.ceil(Math.hypot(x - x0, z - z0) / 1.7));
    for (let i = 1; i <= n; i++) {
      const t = i / n,
        px = x0 + (x - x0) * t + rr(-0.3, 0.3),
        pz = z0 + (z - z0) * t + rr(-0.3, 0.3);
      const m = mesh(stoneG, stoneM, px, H(px, pz) + 0.05, pz);
      m.rotation.y = rr(0, 3);
      m.scale.setScalar(rr(0.8, 1.2));
      scene.add(m);
    }
  }
  const wlG = [
    new THREE.BoxGeometry(6, 3.6, 0.2),
    new THREE.BoxGeometry(0.2, 3.6, 5),
    new THREE.BoxGeometry(1.9, 3.6, 0.2),
    new THREE.BoxGeometry(2.2, 1.4, 0.2),
  ];
  const floorM = M(0x9a6b3f),
    woodM = M(0x6b4a2b),
    steelM = M(0x9aa0a8),
    clothM = [M(0xb04a4a), M(0x4a6fb0), M(0x5a9a5a)],
    jarM = M(0xc98a4a),
    lampM = M(0xffd27a, { emissive: 0xffb84a, emissiveIntensity: 1.5 });
  const bedG = new THREE.BoxGeometry(1.7, 0.4, 0.95),
    matG = new THREE.BoxGeometry(1.6, 0.18, 0.9),
    tabG = new THREE.BoxGeometry(1.3, 0.1, 0.8),
    legG = new THREE.BoxGeometry(0.12, 0.8, 0.12),
    shG = new THREE.BoxGeometry(2, 0.08, 0.35),
    jarG = new THREE.CylinderGeometry(0.12, 0.12, 0.3, 6),
    bucG = new THREE.CylinderGeometry(0.3, 0.24, 0.4, 8),
    sakG = new THREE.SphereGeometry(0.4, 6, 5),
    rugG = new THREE.BoxGeometry(2, 0.03, 1.4),
    lampG = new THREE.BoxGeometry(0.2, 0.25, 0.2);
  const picks = [];
  function house(x, z, wall, roof) {
    const ry = Math.atan2(0, RZ(x) - z),
      g = new THREE.Group(),
      wlM = M(wall, { transparent: true }),
      rfM = M(roof, { transparent: true }),
      A = (geo, m, px, py, pz) => {
        const o = mesh(geo, m, px, py, pz);
        g.add(o);
        return o;
      };
    A(new THREE.BoxGeometry(6, 0.04, 5), floorM, 0, 0.02, 0);
    A(wlG[0], wlM, 0, 1.8, -2.4);
    A(wlG[1], wlM, -2.9, 1.8, 0);
    A(wlG[1], wlM, 2.9, 1.8, 0);
    A(wlG[2], wlM, -2.05, 1.8, 2.4);
    A(wlG[2], wlM, 2.05, 1.8, 2.4);
    A(wlG[3], wlM, 0, 2.9, 2.4);
    const r = A(new THREE.ConeGeometry(4.9, 2.7, 4), rfM, 0, 4.95, 0);
    r.rotation.y = Math.PI / 4;
    r.scale.z = 0.85;
    [-2, 2].forEach((wx) => {
      const wl = M(0xffe9a8, { emissive: 0xffb84a, emissiveIntensity: 0.7 });
      wins.push(wl);
      A(new THREE.BoxGeometry(1, 1, 0.12), wl, wx, 2.2, 2.52);
    });
    A(new THREE.BoxGeometry(0.9, 2, 0.9), M(0x8a8078), 1.8, 4.8, -1);
    A(rugG, clothM[wall % 3], 0, 0.05, 0.3);
    A(bedG, woodM, -1.9, 0.3, -1.7);
    A(matG, clothM[roof % 3], -1.9, 0.6, -1.7);
    A(tabG, woodM, 1.7, 0.8, -1.8);
    A(legG, woodM, 1.2, 0.4, -1.5);
    A(legG, woodM, 2.2, 0.4, -2.1);
    A(lampG, lampM, 1.7, 1, -1.8);
    A(shG, woodM, 0, 1.7, -2.25);
    [-0.6, 0, 0.6].forEach((j) => A(jarG, jarM, j, 1.9, -2.25));
    A(bucG, woodM, -2.3, 0.32, 0.6);
    A(sakG, clothM[(wall + 1) % 3], 2.3, 0.4, 1.3);
    const tool = hlist.length % 2 ? "rod" : "axe",
      it = new THREE.Group(); // kampak dan pancing bergantian di tiap rumah
    if (tool === "axe") {
      it.add(
        mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 5), woodM),
        mesh(new THREE.BoxGeometry(0.06, 0.25, 0.4), steelM, 0, 0.4, 0.15),
      );
      it.position.set(2.7, 1.5, 0.2);
    } else {
      it.add(mesh(new THREE.CylinderGeometry(0.025, 0.045, 2.6, 5), woodM));
      it.position.set(-2.55, 1.4, 1.5);
      it.rotation.z = 0.12;
    }
    g.add(it);
    g.position.set(x, H(x, z), z);
    g.rotation.y = ry;
    scene.add(g);
    chim.push([
      x + 1.8 * Math.cos(ry) - Math.sin(ry),
      H(x, z) + 5.9,
      z - 1.8 * Math.sin(ry) - Math.cos(ry),
    ]);
    const c = Math.cos(ry),
      s = Math.sin(ry),
      W = (a, b, e, f) => {
        const n = Math.max(1, Math.round(Math.hypot(e - a, f - b) / 0.35));
        for (let i = 0; i <= n; i++) {
          const lx = a + ((e - a) * i) / n,
            lz = b + ((f - b) * i) / n;
          solids.push([x + lx * c + lz * s, z - lx * s + lz * c, 0.2]);
        }
      };
    W(-3, -2.5, 3, -2.5);
    W(-3, -2.5, -3, 2.5);
    W(3, -2.5, 3, 2.5);
    W(-3, 2.5, -1.1, 2.5);
    W(1.1, 2.5, 3, 2.5);
    picks.push({
      it,
      tool,
      x: x + it.position.x * c + it.position.z * s,
      z: z - it.position.x * s + it.position.z * c,
    });
    hlist.push([x, z, ry, wlM, rfM, H(x, z)]);
    path(
      x,
      RZ(x) + (z < RZ(x) ? -5.2 : 5.2),
      x + Math.sin(ry) * 3.8,
      z + Math.cos(ry) * 3.8,
    );
  }

  // 14 rumah di kedua tepi sungai, pintu menghadap sungai
  const WALLS = [0xe8d5b0, 0xd9e3c4, 0xf0c9a0, 0xe9e1d0, 0xcfd8e8, 0xf3dcc4],
    ROOFS = [0xb5452f, 0x4f6d8c, 0x6b4a8c, 0x8a3b3b, 0x3f7a5a, 0x9a6b2f];
  [-44, -34, -24, -14, 14, 24, 34, 44].forEach((x, i) =>
    house(
      x + rr(-1.5, 1.5),
      RZ(x) + 12.5 + rr(-1, 1),
      WALLS[i % 6],
      ROOFS[(i * 5) % 6],
    ),
  );
  [-40, -30, -20, 20, 30, 40].forEach((x, i) =>
    house(
      x + rr(-1.5, 1.5),
      RZ(x) - 12.5 + rr(-1, 1),
      WALLS[(i + 2) % 6],
      ROOFS[(i * 5 + 1) % 6],
    ),
  );
  path(12, -60, 12, -28);
  path(0, -90, 12, -60);
  path(12, -28, 0, RZ(0) - 6.5);
  path(0, RZ(0) + 6.5);
  path(0, RZ(0) - 8.5, 0, RZ(0) - 6.5);

  const postG = new THREE.BoxGeometry(0.25, 1.3, 0.25),
    fm = M(0x8a5a33);
  function fence(ax, az, bx, bz) {
    const dx = bx - ax,
      dz = bz - az,
      L = Math.hypot(dx, dz),
      n = Math.round(L / 1.2),
      th = Math.atan2(dx, dz);
    for (let i = 0; i <= n; i++) {
      const x = ax + (dx * i) / n,
        z = az + (dz * i) / n;
      scene.add(mesh(postG, fm, x, H(x, z) + 0.65, z));
      solids.push([x, z, 0.3]);
    }
    [0.5, 1].forEach((y) => {
      const r = mesh(
        new THREE.BoxGeometry(0.1, 0.12, L),
        fm,
        ax + dx / 2,
        H(ax + dx / 2, az + dz / 2) + y,
        az + dz / 2,
      );
      r.rotation.y = th;
      scene.add(r);
    });
  }
  fence(-6, 22, -6, 32);
  fence(6, 22, 6, 32);
  fence(-6, 32, 6, 32);
  fence(-6, 22, -2, 22);
  fence(2, 22, 6, 22);

  // ---------- Dunia tambahan: langit berubah, kolam, kincir, rumput, bunga, asap ----------
  const S0 = ["#4a5fa8", "#d98fa0", "#f0b68a", "#f0b68a"].map(
      (c) => new THREE.Color(c),
    ),
    S1 = ["#070b1d", "#121a40", "#26305f", "#26305f"].map(
      (c) => new THREE.Color(c),
    ),
    tc = new THREE.Color();
  function paintSky(n) {
    const g = sx.createLinearGradient(0, 0, 0, 256);
    [0, 0.5, 0.8, 1].forEach((p, i) =>
      g.addColorStop(p, "#" + tc.copy(S0[i]).lerp(S1[i], n).getHexString()),
    );
    sx.fillStyle = g;
    sx.fillRect(0, 0, 2, 256);
    scene.background.needsUpdate = true;
    scene.fog.color.copy(S0[2]).lerp(S1[2], n);
  }
  const star = [];
  for (let i = 0; i < 350; i++) {
    const a = rr(0, 6.28),
      e = rr(0.1, 1.4);
    star.push(
      Math.cos(a) * Math.cos(e) * 220,
      Math.sin(e) * 220,
      Math.sin(a) * Math.cos(e) * 220,
    );
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(star, 3),
    ),
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      fog: false,
    }),
  );
  stars.frustumCulled = false;
  scene.add(stars);

  const pond = new THREE.CircleGeometry(7, 22);
  pond.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(
    pond,
    M(0x3b8fb5, {
      transparent: true,
      opacity: 0.88,
      roughness: 0.25,
      metalness: 0.15,
    }),
  );
  water.position.set(0, H(0, -34) + 0.2, -34);
  water.receiveShadow = true;
  scene.add(water);
  solids.push([0, -34, 6.3]);
  const sg = new THREE.DodecahedronGeometry(1, 0),
    sgm = M(0x8f8f95),
    padG = new THREE.CylinderGeometry(0.6, 0.6, 0.05, 8),
    padM = M(0x4f9a4a);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 6.283,
      sc = rr(0.5, 0.9),
      r = mesh(
        sg,
        sgm,
        Math.cos(a) * 7.2,
        H(0, -34) + sc * 0.3,
        -34 + Math.sin(a) * 7.2,
      );
    r.scale.set(sc, sc * 0.7, sc);
    r.rotation.y = rr(0, 3);
    scene.add(r);
  }
  for (let i = 0; i < 6; i++) {
    const a = rr(0, 6.28),
      d = rr(1, 5);
    scene.add(
      mesh(
        padG,
        padM,
        Math.cos(a) * d,
        H(0, -34) + 0.32,
        -34 + Math.sin(a) * d,
      ),
    );
  }

  const WX = 36,
    WZ = 26,
    wm = new THREE.Group(),
    wood = M(0x5a3a22);
  wm.add(
    mesh(new THREE.CylinderGeometry(1.6, 2.5, 7, 8), M(0xe8e0d0), 0, 3.5, 0),
  );
  wm.add(mesh(new THREE.ConeGeometry(2.1, 2.4, 8), M(0x9c3d2c), 0, 8.1, 0));
  wm.add(mesh(new THREE.BoxGeometry(1, 1.8, 0.15), wood, 0, 0.9, 2.3));
  const blades = new THREE.Group();
  blades.position.set(0, 6.6, 2.1);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(mesh(new THREE.BoxGeometry(0.18, 6, 0.14), wood, 0, 3, 0));
    arm.add(
      mesh(new THREE.BoxGeometry(0.9, 3.6, 0.08), M(0xf2ead8), 0.5, 3.6, 0.06),
    );
    blades.add(arm);
  }
  blades.add(mesh(new THREE.SphereGeometry(0.4, 8, 6), wood));
  wm.add(blades);
  wm.position.set(WX, H(WX, WZ), WZ);
  wm.rotation.y = Math.atan2(-WX, -WZ);
  scene.add(wm);
  solids.push([WX, WZ, 2.8]);
  path(WX + Math.sin(wm.rotation.y) * 3.4, WZ + Math.cos(wm.rotation.y) * 3.4);

  const gm = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.14, 0.7, 4),
      M(0xffffff),
      1800,
    ),
    fl = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.17, 5, 4),
      M(0xffffff, { emissive: 0x222222 }),
      300,
    ),
    dm = new THREE.Object3D(),
    cc = new THREE.Color();
  const GC = [0x6aa84a, 0x86bf52, 0x4f8f3c],
    FC = [0xff7aa8, 0xffffff, 0xffd24a, 0xb58cff, 0xff8a5a];
  let gi = 0,
    fi = 0;
  for (let n = 0; n < 6000 && (gi < 1800 || fi < 300); n++) {
    const x = rr(-85, 85),
      z = rr(-85, 85);
    if (
      Math.abs(z - RZ(x)) < 5.2 ||
      nearPath(x, z) ||
      solids.some((o) => Math.hypot(o[0] - x, o[1] - z) < o[2])
    )
      continue;
    dm.position.set(x, H(x, z) + (n % 6 ? 0.3 : 0.2), z);
    dm.rotation.set(rr(-0.2, 0.2), rr(0, 6), rr(-0.2, 0.2));
    dm.scale.setScalar(rr(0.7, 1.5));
    dm.updateMatrix();
    if (n % 6 && gi < 1800) {
      gm.setMatrixAt(gi, dm.matrix);
      gm.setColorAt(gi++, cc.setHex(GC[n % 3]));
    } else if (n % 6 === 0 && fi < 300) {
      fl.setMatrixAt(fi, dm.matrix);
      fl.setColorAt(fi++, cc.setHex(FC[n % 5]));
    }
  }
  gm.count = gi;
  fl.count = fi;
  scene.add(gm, fl);
  const puffs = [];
  chim.forEach((c) => {
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.4, 0),
        new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true }),
      );
      p.userData = { c, k };
      scene.add(p);
      puffs.push(p);
    }
  });

  const pg = [
    new THREE.ConeGeometry(2, 3, 7),
    new THREE.ConeGeometry(1.6, 2.6, 7),
    new THREE.ConeGeometry(1.1, 2.2, 7),
  ];
  const trunkG = new THREE.CylinderGeometry(0.25, 0.35, 2, 6),
    pm = [M(0x2f6b3a), M(0x3d8046)],
    tm = M(0x6b4a2b);
  function pine(x, z) {
    const g = new THREE.Group(),
      sc = rr(0.8, 1.5);
    g.add(mesh(trunkG, tm, 0, 1, 0));
    [2.6, 4, 5.2].forEach((y, i) => g.add(mesh(pg[i], pm[i % 2], 0, y, 0)));
    g.position.set(x, H(x, z), z);
    g.scale.setScalar(sc);
    g.rotation.y = rr(0, 6);
    scene.add(g);
    solids.push([x, z, 0.5 * sc]);
    trees.push({ g, x, z, hp: 3, sol: solids[solids.length - 1] });
  }
  const palmT = new THREE.CylinderGeometry(0.18, 0.3, 5, 6),
    leafG = new THREE.SphereGeometry(1, 5, 3),
    lm = M(0x4fa34a),
    nutG = new THREE.SphereGeometry(0.28, 6, 5);
  function palm(x, z) {
    const g = new THREE.Group(),
      t = mesh(palmT, tm, 0, 2.5, 0);
    t.rotation.z = 0.1;
    g.add(t);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2,
        l = mesh(
          leafG,
          lm,
          -0.25 + Math.cos(a) * 1.4,
          4.9 - 0.15,
          Math.sin(a) * 1.4,
        );
      l.scale.set(1.7, 0.12, 0.45);
      l.rotation.y = -a;
      l.rotation.z = Math.cos(a) * 0.0;
      g.add(l);
    }
    [0, 2, 4].forEach((i) =>
      g.add(mesh(nutG, tm, -0.25 + Math.cos(i) * 0.3, 4.7, Math.sin(i) * 0.3)),
    );
    g.position.set(x, H(x, z), z);
    g.rotation.y = rr(0, 6);
    scene.add(g);
    solids.push([x, z, 0.45]);
    trees.push({ g, x, z, hp: 3, sol: solids[solids.length - 1] });
  }
  const rockG = new THREE.DodecahedronGeometry(1, 0),
    rockM = M(0x8f8f95);
  for (let i = 0, n = 0; i < 400 && n < 130; i++) {
    const x = rr(-95, 95),
      z = rr(-95, 95);
    if (!free(x, z, 2.5)) continue;
    n++;
    if (n % 5 === 0) {
      const sc = rr(0.5, 1.6),
        r = mesh(rockG, rockM, x, H(x, z) + sc * 0.3, z);
      r.scale.set(sc, sc * rr(0.5, 0.8), sc);
      r.rotation.set(rr(0, 3), rr(0, 3), 0);
      scene.add(r);
      if (sc > 0.8) solids.push([x, z, sc * 0.9]);
    } else if (n % 6 === 0) palm(x, z);
    else pine(x, z);
  }

  // ---------- Awan, kunang-kunang ----------
  const clouds = [],
    cloudM = M(0xffffff, {
      emissive: 0xffc8b0,
      emissiveIntensity: 0.4,
      fog: false,
    });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), cloudM);
      b.position.set(j * 3 - 4, rr(-0.5, 0.5), rr(-1, 1));
      b.scale.set(rr(2, 3.5), rr(1.2, 2), rr(1.5, 2.5));
      c.add(b);
    }
    c.position.set(rr(-130, 130), rr(40, 55), rr(-130, 40));
    scene.add(c);
    clouds.push(c);
  }
  const fp = [];
  for (let i = 0; i < 140; i++) fp.push(rr(-60, 60), rr(0.6, 5), rr(-60, 60));
  const flies = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(fp, 3),
    ),
    new THREE.PointsMaterial({
      color: 0xfff0a0,
      size: 0.35,
      transparent: true,
      opacity: 0.9,
    }),
  );
  scene.add(flies);

  // ---------- Karakter ----------
  const P = new THREE.Group(),
    V = new THREE.Group();
  P.add(V);
  const skin = M(0xf1c27d),
    shirt = M(0xd9503f),
    pants = M(0x36548c),
    brown = M(0x5a3a22),
    dark = M(0x222222);
  V.add(
    mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.95, 8), shirt, 0, 1.1, 0),
  );
  V.add(mesh(new THREE.SphereGeometry(0.36, 12, 10), skin, 0, 1.85, 0));
  V.add(
    mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 12), brown, 0, 2.08, 0),
  );
  V.add(mesh(new THREE.ConeGeometry(0.4, 0.5, 8), brown, 0, 2.32, 0));
  [-0.12, 0.12].forEach((x) =>
    V.add(mesh(new THREE.SphereGeometry(0.05, 6, 6), dark, x, 1.88, 0.33)),
  );
  V.add(mesh(new THREE.BoxGeometry(0.5, 0.6, 0.25), brown, 0, 1.15, -0.42));
  const limb = (x, y, r, len, mat) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    g.add(
      mesh(new THREE.CylinderGeometry(r, r * 0.9, len, 6), mat, 0, -len / 2, 0),
    );
    V.add(g);
    return g;
  };
  const aL = limb(-0.55, 1.5, 0.11, 0.8, shirt),
    aR = limb(0.55, 1.5, 0.11, 0.8, shirt),
    lL = limb(-0.2, 0.65, 0.14, 0.65, pants),
    lR = limb(0.2, 0.65, 0.14, 0.65, pants);
  scene.add(P);

  // ---------- Pak Darto (penduduk desa) ----------
  const NX = -5,
    NZ = 4,
    npc = P.clone();
  npc.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      const h = o.material.color.getHex();
      if (h === 0xd9503f) o.material.color.setHex(0x4f8f6d);
      else if (h === 0x5a3a22) o.material.color.setHex(0xe3d08a);
      else if (h === 0x36548c) o.material.color.setHex(0x6b4a2b);
    }
  });
  npc.position.set(NX, H(NX, NZ), NZ);
  scene.add(npc);
  solids.push([NX, NZ, 0.7]);

  // ---------- Penduduk lain yang sedang beraktivitas ----------
  function villager(x, z, shirt, hat, pants, sc, skin) {
    const g = P.clone(),
      V = g.children[0],
      n = V.children.length;
    g.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        const h = o.material.color.getHex();
        if (h === 0xd9503f) o.material.color.setHex(shirt);
        else if (h === 0x5a3a22) o.material.color.setHex(hat);
        else if (h === 0x36548c) o.material.color.setHex(pants);
        else if (skin !== undefined && h === 0xf1c27d)
          o.material.color.setHex(skin);
        if (o.isLight) o.visible = false;
      }
    });
    g.position.set(x, H(x, z), z);
    g.scale.setScalar(sc || 1);
    scene.add(g);
    return {
      g,
      V,
      aL: V.children[n - 4],
      aR: V.children[n - 3],
      lL: V.children[n - 2],
      lR: V.children[n - 1],
    };
  }
  // Pak Heru memancing di tepi kolam
  const fish = villager(2, -25.9, 0x3d6fa8, 0xd8c27a, 0x5a4a38),
    fd = new THREE.Vector3(-2, 0, -8.1).normalize();
  fish.g.rotation.y = Math.atan2(fd.x, fd.z);
  solids.push([2, -25.9, 0.7]);
  const rod = mesh(
    new THREE.CylinderGeometry(0.03, 0.05, 3, 5),
    wood,
    0.35,
    2.2,
    1.86,
  );
  rod.rotation.x = 1;
  fish.g.add(rod);
  const bob = mesh(
      new THREE.SphereGeometry(0.12, 6, 5),
      M(0xff4a3a),
      0,
      0,
      5.8,
    ),
    bobY = water.position.y - fish.g.position.y + 0.08;
  fish.g.add(bob);
  fish.g.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.35, 3, 3.1),
        new THREE.Vector3(0, bobY, 5.8),
      ]),
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    ),
  );
  fish.aL.rotation.x = -1.2;
  // Pak Tani mencangkul petak tanah
  const farm = villager(6, -4.3, 0xc9a23c, 0xe3d08a, 0x4a4a52);
  farm.g.rotation.y = Math.PI;
  solids.push([6, -4.3, 0.7]);
  farm.aR.add(
    mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5), wood, 0, -1.4, 0),
  );
  farm.aR.add(
    mesh(new THREE.BoxGeometry(0.5, 0.08, 0.26), M(0x8f8f95), 0, -2, 0.1),
  );
  scene.add(
    mesh(
      new THREE.BoxGeometry(3.6, 0.12, 2),
      M(0x5b3d24),
      6,
      H(6, -6.3) + 0.06,
      -6.3,
    ),
  );
  // Bu Ratmi menyapu halaman rumah
  const hl = hlist[3],
    sry = hl[2],
    swx = hl[0] + Math.sin(sry) * 6.4 + Math.cos(sry) * 2.4,
    swz = hl[1] + Math.cos(sry) * 6.4 - Math.sin(sry) * 2.4;
  const sweep = villager(swx, swz, 0xb04a7a, 0xe8c9a0, 0x4a3a5a);
  sweep.g.rotation.y = sry + Math.PI;
  solids.push([swx, swz, 0.7]);
  sweep.aR.add(
    mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), wood, 0, -1.5, 0),
  );
  const brush = mesh(
    new THREE.ConeGeometry(0.28, 0.45, 6),
    M(0xc9a85a),
    0,
    -2.45,
    0,
  );
  brush.rotation.x = Math.PI;
  sweep.aR.add(brush);
  // Si Kecil bolak-balik di jalan setapak
  const kid = villager(3, 2.7, 0x3aa6b9, 0xf2c14e, 0x7a3b3b, 0.72),
    KA = [3, 2.7],
    KB = [13, 12.5];
  let kt = 0,
    kdir = 1;
  // Domba di kandang
  const sheep = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group(),
      wl = M(0xf4f1e8),
      dk = M(0x3a3330),
      b = mesh(new THREE.IcosahedronGeometry(0.75, 1), wl, 0, 0.85, 0);
    b.scale.set(1.1, 0.85, 0.8);
    g.add(b);
    g.add(mesh(new THREE.SphereGeometry(0.28, 6, 5), dk, 0.82, 1, 0));
    [
      [0.4, 0.3],
      [0.4, -0.3],
      [-0.4, 0.3],
      [-0.4, -0.3],
    ].forEach((l) =>
      g.add(
        mesh(
          new THREE.CylinderGeometry(0.07, 0.07, 0.5, 5),
          dk,
          l[0],
          0.25,
          l[1],
        ),
      ),
    );
    const x = rr(-4, 4),
      z = rr(24, 30);
    g.position.set(x, H(x, z), z);
    scene.add(g);
    sheep.push({ g, tx: x, tz: z, wait: rr(0, 3) });
  }
  // ---------- Sungai, jembatan, ikan, warga yang mandi dan mencuci ----------
  const rvg = new THREE.PlaneGeometry(220, 15, 110, 5);
  rvg.rotateX(-Math.PI / 2);
  const rvp = rvg.attributes.position;
  for (let i = 0; i < rvp.count; i++)
    rvp.setZ(i, rvp.getZ(i) + RZ(rvp.getX(i)));
  const river = new THREE.Mesh(
    rvg,
    M(0x3b8fb5, {
      transparent: true,
      opacity: 0.68,
      roughness: 0.2,
      metalness: 0.1,
    }),
  );
  river.position.y = -0.35;
  river.receiveShadow = true;
  scene.add(river);
  const RZ0 = RZ(0),
    deckM = M(0x8a5a33);
  scene.add(mesh(new THREE.BoxGeometry(2.6, 0.16, 13.4), deckM, 0, 0.3, RZ0));
  [-1.3, 1.3].forEach((x) => {
    scene.add(mesh(new THREE.BoxGeometry(0.12, 0.1, 13.4), deckM, x, 1.1, RZ0));
    for (let k = -3; k <= 3; k++)
      scene.add(
        mesh(
          new THREE.BoxGeometry(0.18, 1, 0.18),
          deckM,
          x,
          0.8,
          RZ0 + k * 2.1,
        ),
      );
  });
  const fishBody = new THREE.OctahedronGeometry(0.5, 0),
    fishTail = new THREE.ConeGeometry(0.28, 0.5, 4),
    FM = [0xff8a3d, 0xc9d3dc, 0xffc83a, 0xe85a5a].map((c) =>
      M(c, { emissive: c, emissiveIntensity: 0.3 }),
    ),
    fishes = [];
  for (let i = 0; i < 32; i++) {
    const g = new THREE.Group(),
      m = FM[i % 4],
      b = new THREE.Mesh(fishBody, m),
      t = new THREE.Mesh(fishTail, m);
    b.scale.set(1.5, 0.55, 0.45);
    t.position.x = -0.85;
    t.rotation.z = -Math.PI / 2;
    g.add(b, t);
    scene.add(g);
    fishes.push({
      g,
      t,
      pond: i >= 26,
      ph: rr(0, 6.28),
      sp: rr(0.5, 1.4) * (rnd() < 0.5 ? -1 : 1),
      off: rr(-2.4, 2.4),
      x0: rr(-70, 70),
      R: rr(2, 5),
    });
  }
  const bth = [
    [8, 1.3],
    [10.5, -0.4],
    [-16, 0.6],
  ].map(([x, o], i) => {
    const v = villager(
      x,
      RZ(x) + o,
      [0xe0a050, 0x6fa88a, 0xc0505a][i],
      0x3a2a1a,
      0x36548c,
      0.85,
    );
    v.g.rotation.y = rr(0, 6);
    v.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.85, 20),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    v.ring.rotation.x = -Math.PI / 2;
    v.ring.position.set(x, -0.3, RZ(x) + o);
    scene.add(v.ring);
    return v;
  });
  const wsh = [-6, -9.2].map((x, i) => {
    const z = RZ(x) + 5.7,
      v = villager(
        x,
        z,
        [0xd96a8a, 0x5aa36a][i],
        [0xe8c9a0, 0xf2e6b0][i],
        0x4a3a5a,
      );
    v.g.rotation.y = Math.PI;
    v.V.position.y = -0.55;
    v.lL.rotation.x = v.lR.rotation.x = -1.4;
    solids.push([x, z, 0.7]);
    const st = mesh(
      new THREE.DodecahedronGeometry(0.8, 0),
      sgm,
      x,
      H(x, z - 1) + 0.2,
      z - 1.1,
    );
    st.scale.set(1, 0.3, 0.8);
    scene.add(st);
    [0xff8a8a, 0x7ec8ff].forEach((c, j) =>
      scene.add(
        mesh(
          new THREE.BoxGeometry(0.5, 0.05, 0.4),
          M(c),
          x - 0.15 + j * 0.35,
          H(x, z - 1) + 0.46,
          z - 1.05 + j * 0.1,
        ),
      ),
    );
    scene.add(
      mesh(
        new THREE.CylinderGeometry(0.5, 0.4, 0.45, 8),
        M(0xb8883f),
        x + 1.2,
        H(x, z) + 0.22,
        z - 0.2,
      ),
    );
    return v;
  });
  function creek(dt) {
    const t = time;
    for (let i = 0; i < rvp.count; i++)
      rvp.setY(
        i,
        0.06 * Math.sin(rvp.getX(i) * 0.6 - t * 2.2 + rvp.getZ(i) * 0.8),
      );
    rvp.needsUpdate = true;
    fishes.forEach((f) => {
      let x,
        z,
        y = -0.42,
        dx,
        dz;
      if (f.pond) {
        const a = t * f.sp * 0.5 + f.ph,
          s = Math.sign(f.sp);
        x = Math.cos(a) * f.R;
        z = -34 + Math.sin(a) * f.R;
        dx = -Math.sin(a) * s;
        dz = Math.cos(a) * s;
        y = water.position.y;
      } else {
        x = ((((f.x0 + f.sp * t + 70) % 140) + 140) % 140) - 70;
        z = RZ(x) + f.off + Math.sin(t * 0.8 + f.ph) * 1.2;
        const x2 = x + 0.3 * Math.sign(f.sp),
          z2 = RZ(x2) + f.off + Math.sin(t * 0.8 + f.ph + 0.1) * 1.2;
        dx = x2 - x;
        dz = z2 - z;
        const p = (t * 0.15 + f.ph) % 1;
        if (f.ph < 2 && p < 0.06) y += Math.sin((p / 0.06) * Math.PI) * 1.1;
      }
      f.g.position.set(x, y, z);
      f.g.rotation.y = Math.atan2(-dz, dx);
      f.t.rotation.y = Math.sin(t * 10 + f.ph) * 0.5;
    });
    bth.forEach((v, i) => {
      v.aL.rotation.x = -2.5 + Math.sin(t * 6 + i) * 0.5;
      v.aR.rotation.x = -1.3 + Math.cos(t * 5 + i) * 0.6;
      v.V.position.y = Math.sin(t * 2 + i) * 0.04;
      v.g.rotation.y += dt * 0.3;
      const k = (t * 0.6 + i * 0.33) % 1;
      v.ring.scale.setScalar(0.6 + k * 2.2);
      v.ring.material.opacity = 0.6 * (1 - k);
    });
    wsh.forEach((v, i) => {
      const s = Math.sin(t * 5 + i * 2) * 0.35;
      v.aL.rotation.x = -1.2 + s;
      v.aR.rotation.x = -1.2 - s;
      v.V.rotation.x = 0.2 + Math.sin(t * 2.5 + i) * 0.05;
    });
  }
  function crew(dt) {
    creek(dt);
    const t = time,
      s = Math.sin(t * 3);
    bob.position.y = bobY + Math.sin(t * 3) * 0.04;
    fish.aR.rotation.x =
      -1.2 - 0.3 * Math.pow(Math.max(0, Math.sin(t * 0.6)), 6);
    fish.V.rotation.x = Math.sin(t * 0.8) * 0.03;
    farm.aL.rotation.x = farm.aR.rotation.x = -1 - 0.9 * s;
    farm.V.rotation.x = 0.25 + 0.12 * s;
    sweep.aR.rotation.x = -0.5 + Math.sin(t * 4) * 0.4;
    sweep.aL.rotation.x = -0.3 - Math.sin(t * 4) * 0.2;
    sweep.V.rotation.x = 0.15;
    const L = Math.hypot(KB[0] - KA[0], KB[1] - KA[1]);
    kt += (kdir * dt * 1.7) / L;
    if (kt > 1) {
      kt = 1;
      kdir = -1;
    }
    if (kt < 0) {
      kt = 0;
      kdir = 1;
    }
    const kx = KA[0] + (KB[0] - KA[0]) * kt,
      kz = KA[1] + (KB[1] - KA[1]) * kt,
      w = Math.sin(t * 9) * 0.8;
    kid.g.position.set(kx, H(kx, kz) + Math.abs(Math.sin(t * 9)) * 0.06, kz);
    kid.g.rotation.y = Math.atan2(
      (KB[0] - KA[0]) * kdir,
      (KB[1] - KA[1]) * kdir,
    );
    kid.aL.rotation.x = w;
    kid.aR.rotation.x = -w;
    kid.lL.rotation.x = -w;
    kid.lR.rotation.x = w;
    sheep.forEach((o, i) => {
      const p = o.g.position;
      if (o.wait > 0) {
        o.wait -= dt;
        return;
      }
      const dx = o.tx - p.x,
        dz = o.tz - p.z,
        d = Math.hypot(dx, dz);
      if (d < 0.2) {
        o.tx = rr(-4.5, 4.5);
        o.tz = rr(24, 30.5);
        o.wait = rr(1, 4);
        return;
      }
      p.x += (dx / d) * 0.9 * dt;
      p.z += (dz / d) * 0.9 * dt;
      p.y = H(p.x, p.z) + Math.abs(Math.sin(t * 8 + i)) * 0.05;
      o.g.rotation.y = Math.atan2(-dz, dx);
    });
  }
  let t0 = 0,
    lastTxt = "",
    skyT = 0,
    ac;
  const fmt = (s) =>
    String(Math.floor(s / 60)).padStart(2, "0") +
    ":" +
    String(Math.floor(s % 60)).padStart(2, "0");
  const beep = (f, d, t, v) => {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(),
        g = ac.createGain();
      o.type = t || "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(v || 0.12, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d);
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + d);
    } catch (e) {}
  };
  const DIRS = [
      "depan",
      "depan kanan",
      "kanan",
      "belakang kanan",
      "belakang",
      "belakang kiri",
      "kiri",
      "depan kiri",
    ],
    wpos = pond.attributes.position;
  // ---------- Siklus waktu: siang, sore, malam, pagi (1 putaran = 200 detik) ----------
  const K = [
    {
      s: ["#3d7fd1", "#79b4ec", "#cfe6f5", "#cfe6f5"],
      l: 0xfff1d0,
      si: 1.35,
      hi: 0.95,
      ex: 1.05,
      st: 0,
      w: 0.2,
      e: 60,
      d: 0xfff4d0,
      c: 0xffffff,
      f: 0.1,
    },
    {
      s: ["#4a5fa8", "#d98fa0", "#f0b68a", "#f0b68a"],
      l: 0xffb878,
      si: 1.25,
      hi: 0.75,
      ex: 1.1,
      st: 0,
      w: 0.9,
      e: 14,
      d: 0xffd090,
      c: 0xffd6c4,
      f: 0.5,
    },
    {
      s: ["#01030a", "#050918", "#0a1029", "#0a1029"],
      l: 0x6f84e0,
      si: 0.1,
      hi: 0.1,
      ex: 0.85,
      st: 1,
      w: 3,
      e: 48,
      d: 0xdfe6ff,
      c: 0x3a4468,
      f: 1,
    },
    {
      s: ["#5a6fa8", "#e8a99a", "#f4cfa0", "#f4cfa0"],
      l: 0xffc890,
      si: 0.9,
      hi: 0.55,
      ex: 1,
      st: 0.2,
      w: 1,
      e: 10,
      d: 0xffd9a0,
      c: 0xffe0d0,
      f: 0.4,
    },
  ];
  K.splice(3, 0, Object.assign({}, K[2])); // malam dibuat lebih lama
  const lamp = new THREE.PointLight(0xffc880, 0, 22);
  lamp.position.set(0, 2.4, 0.5);
  P.add(lamp);
  K.forEach((k) => {
    k.s = k.s.map((c) => new THREE.Color(c));
    ["l", "d", "c"].forEach((q) => (k[q] = new THREE.Color(k[q])));
  });
  const cur = {
      s: [0, 1, 2, 3].map(() => new THREE.Color()),
      l: new THREE.Color(),
      d: new THREE.Color(),
      c: new THREE.Color(),
    },
    PH = ["Siang", "Sore", "Malam", "Malam", "Pagi"],
    AZ = Math.atan2(28, 55);
  let ph = 0;
  function cycle() {
    ph = ((time + tOff) / 200) % 1;
    const N = K.length,
      i = Math.floor(ph * N),
      f = ph * N - i,
      u = f * f * (3 - 2 * f),
      a = K[i],
      b = K[(i + 1) % N],
      m = (x, y) => x + (y - x) * u;
    ["l", "d", "c"].forEach((q) => cur[q].copy(a[q]).lerp(b[q], u));
    cur.s.forEach((c, j) => c.copy(a.s[j]).lerp(b.s[j], u));
    const night = m(a.st, b.st),
      e = (m(a.e, b.e) * Math.PI) / 180;
    SUNDIR.set(
      Math.cos(AZ) * Math.cos(e),
      Math.sin(e),
      Math.sin(AZ) * Math.cos(e),
    ).multiplyScalar(66);
    sun.color.copy(cur.l);
    sun.intensity = m(a.si, b.si);
    hemi.intensity = m(a.hi, b.hi);
    renderer.toneMappingExposure = m(a.ex, b.ex);
    disc.material.color.copy(cur.d);
    stars.material.opacity = night;
    lamp.intensity = 2.4 * night;
    stars.position.copy(cam.position);
    cloudM.color.copy(cur.c);
    cloudM.emissive.copy(cur.c);
    flies.material.opacity = 0.2 + 0.8 * m(a.f, b.f);
    wins.forEach((w) => (w.emissiveIntensity = m(a.w, b.w)));
    if (time - skyT > 0.3) {
      skyT = time;
      const g = sx.createLinearGradient(0, 0, 0, 256);
      [0, 0.5, 0.8, 1].forEach((p, j) =>
        g.addColorStop(p, "#" + cur.s[j].getHexString()),
      );
      sx.fillStyle = g;
      sx.fillRect(0, 0, 2, 256);
      scene.background.needsUpdate = true;
      scene.fog.color.copy(cur.s[2]);
    }
  }
  function extras(dt) {
    crew(dt);
    net(dt);
    cycle();
    act(dt);
    for (let i = 0; i < wpos.count; i++)
      wpos.setY(
        i,
        0.07 * Math.sin(time * 2 + wpos.getX(i) * 1.3 + wpos.getZ(i) * 1.1),
      );
    wpos.needsUpdate = true;
    blades.rotation.z += dt * 0.8;
    puffs.forEach((p) => {
      const t = (time * 0.3 + p.userData.k * 0.25) % 1,
        c = p.userData.c;
      p.position.set(c[0] + t * 1.5, c[1] + t * 4, c[2]);
      p.scale.setScalar(0.5 + t * 1.8);
      p.material.opacity = 0.55 * (1 - t);
    });
    npc.rotation.y = Math.atan2(px - NX, pz - NZ);
    npc.position.y = H(NX, NZ) + Math.sin(time * 1.5) * 0.03;
    let txt = "";
    if (running && !quizOn && stage < 2 && Math.hypot(px - NX, pz - NZ) < 8) {
      if (stage)
        txt =
          "Hati-hati di dalam gua, Nak. Kalau tenagamu habis, makan ikan hasil pancinganmu.";
      else {
        const bx = CAVE.x - px,
          bz = CAVE.z - pz,
          best = Math.hypot(bx, bz);
        const r = bx * Math.cos(yaw) - bz * Math.sin(yaw),
          f = -bx * Math.sin(yaw) - bz * Math.cos(yaw);
        txt =
          "Gua harta karun ada sekitar " +
          Math.round(best) +
          " langkah dari sini, arahnya " +
          DIRS[Math.round(((Math.atan2(r, f) + 6.283) % 6.283) / 0.7854) % 8] +
          " dari hadapanmu." +
          (inv.axe && inv.rod
            ? ""
            : " Oh ya, di dalam rumah warga ada kampak dan alat pancing, ambil saja.");
      }
    }
    $("npc").style.display = txt ? "block" : "none";
    if (txt && txt !== lastTxt) {
      $("nt").textContent = txt;
      lastTxt = txt;
    }
    if (running)
      $("tm").textContent =
        fmt(time - t0) + " · " + PH[Math.round(ph * K.length) % K.length];
  }

  // ---------- Koin & Kristal ----------
  const coinG = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 16),
    coinM = M(0xffc83a, {
      emissive: 0xb87a00,
      emissiveIntensity: 0.8,
      metalness: 0.6,
      roughness: 0.3,
    });
  const beamG = new THREE.CylinderGeometry(0.1, 0.1, 8, 6),
    beamM = new THREE.MeshBasicMaterial({
      color: 0xffd966,
      transparent: true,
      opacity: 0.3,
    });
  const coins = []; // koin dihapus, misi diganti harta karun
  const crystalM = M(0x7a7a88, { emissive: 0x000000 });
  const crystal = mesh(
    new THREE.IcosahedronGeometry(1.1, 0),
    crystalM,
    0,
    2.2,
    0,
  );
  crystal.scale.y = 1.6;
  scene.add(crystal);
  scene.add(
    mesh(new THREE.CylinderGeometry(1.8, 2.2, 0.6, 8), stoneM, 0, 0.3, 0),
  );
  const cLight = new THREE.PointLight(0x40e0ff, 0, 30);
  cLight.position.set(0, 3, 0);
  scene.add(cLight);

  // ---------- Input ----------
  const keys = {};
  addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
  });
  addEventListener("keyup", (e) => (keys[e.code] = false));
  let yaw = 0,
    pitch = 0.42,
    dp = null,
    lx = 0,
    ly = 0;
  cvs.addEventListener("pointerdown", (e) => {
    if (dp === null) {
      dp = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
      cvs.setPointerCapture(e.pointerId);
    }
  });
  cvs.addEventListener("pointermove", (e) => {
    if (e.pointerId !== dp) return;
    yaw -= (e.clientX - lx) * 0.006;
    pitch = Math.min(1.2, Math.max(0.1, pitch + (e.clientY - ly) * 0.005));
    lx = e.clientX;
    ly = e.clientY;
  });
  const dpUp = (e) => {
    if (e.pointerId === dp) dp = null;
  };
  cvs.addEventListener("pointerup", dpUp);
  cvs.addEventListener("pointercancel", dpUp);
  // Joystick & tombol lompat (layar sentuh)
  let joyX = 0,
    joyY = 0;
  const joy = $("joy"),
    knob = $("knob");
  const jm = (e) => {
    const r = joy.getBoundingClientRect(),
      R = r.width / 2;
    let x = (e.clientX - r.left - R) / R,
      y = (e.clientY - r.top - R) / R;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    joyX = x;
    joyY = y;
    knob.style.transform = `translate(${x * R * 0.6}px,${y * R * 0.6}px)`;
  };
  const jr = () => {
    joyX = joyY = 0;
    knob.style.transform = "";
  };
  joy.addEventListener("pointerdown", (e) => {
    joy.setPointerCapture(e.pointerId);
    jm(e);
  });
  joy.addEventListener("pointermove", (e) => {
    if (joy.hasPointerCapture(e.pointerId)) jm(e);
  });
  joy.addEventListener("pointerup", jr);
  joy.addEventListener("pointercancel", jr);
  const jb = $("jump"),
    jset = (v) => () => (keys.Space = v);
  jb.addEventListener("pointerdown", jset(true));
  jb.addEventListener("pointerup", jset(false));
  jb.addEventListener("pointercancel", jset(false));

  let tt;
  const toast = (m) => {
    const e = $("toast");
    e.textContent = m;
    e.style.opacity = 1;
    clearTimeout(tt);
    tt = setTimeout(() => (e.style.opacity = 0), 3500);
  };

  // ---------- Mabar 2 pemain (PeerJS, tanpa server sendiri) ----------
  // Dunia dibuat dari seed yang sama, jadi posisi koin otomatis identik di kedua pemain.
  const rp = villager(0, 0, 0x2f8fd6, 0xf2e6b0, 0x2b2f45);
  rp.g.visible = false;
  let conn = null,
    peer = null,
    isHost = false,
    tOff = 0,
    myName = "Pemain",
    rpT = { x: 0, y: 0, z: 0, f: 0, w: 0, a: 0 },
    sendT = 0,
    rpWalk = 0;
  function nameTag(txt) {
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 64;
    const x = cv.getContext("2d");
    x.font = "700 28px Trebuchet MS, sans-serif";
    x.textAlign = "center";
    const w = x.measureText(txt).width + 26;
    x.fillStyle = "#000a";
    x.fillRect(128 - w / 2, 10, w, 44);
    x.fillStyle = "#fff";
    x.fillText(txt, 128, 42);
    if (rp.tag) rp.g.remove(rp.tag);
    rp.tag = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(cv),
        depthTest: false,
        fog: false,
      }),
    );
    rp.tag.scale.set(3, 0.75, 1);
    rp.tag.position.y = 3;
    rp.tag.renderOrder = 10;
    rp.g.add(rp.tag);
  }
  function setup(c) {
    conn = c;
    const hi = () => c.send({ t: "hi", n: myName, T: time });
    c.open ? hi() : c.on("open", hi);
    c.on("data", (d) => {
      if (d.t === "hi") {
        nameTag(String(d.n).slice(0, 12));
        rp.g.visible = true;
        if (!isHost) tOff = d.T - time;
        toast(d.n + " bergabung!");
        if (!$("start").classList.contains("hidden")) $("go").click();
      } else if (d.t === "s") {
        if (!rp.seen) {
          rp.seen = true;
          rp.g.position.set(d.x, d.y, d.z);
        }
        rpT = d;
      } else if (d.t === "c") {
        const k = coins[d.i];
        if (k) {
          k.ok = true;
          k.remote = true;
        }
      } else if (d.t === "tr") {
        const q = trees[d.i];
        if (q) {
          q.hp = d.h;
          q.shake = 0.3;
          if (q.hp <= 0 && !q.fall) {
            q.fall = time;
            q.sol[0] = q.sol[1] = 1e5;
          }
        }
      } else if (d.t === "f") toast(d.n + " dapat " + d.s + "!");
      else if (d.t === "t") {
        const k = trees[d.i];
        if (k && k.hp > 0) {
          k.hp--;
          k.shake = 0.3;
          if (k.hp <= 0) {
            k.fall = time;
            k.sol[0] = k.sol[1] = 1e5;
          }
        }
      } else if (d.t === "w" && stage < 2) {
        stage = 2;
        running = false;
        $("res").textContent =
          "Temanmu menyentuh kristal. Kalian berhasil bersama!";
        $("end").classList.remove("hidden");
      }
    });
    c.on("close", () => {
      rp.g.visible = false;
      conn = null;
      toast("Temanmu keluar dari permainan.");
    });
  }
  const ready = () => {
    myName = ($("nm").value || "Pemain").trim().slice(0, 12);
    if (typeof Peer === "undefined") {
      $("lob").textContent = "PeerJS gagal dimuat. Cek koneksi internet.";
      return false;
    }
    return true;
  };
  const perr = (e) => {
    console.warn("PeerJS:", e);
    if (e.type === "unavailable-id")
      return "Kode bentrok, klik Buat room sekali lagi.";
    if (e.type === "peer-unavailable")
      return "Room tidak ditemukan. Pastikan temanmu sudah klik Buat room dan kodenya benar.";
    if (e.type === "webrtc")
      return "Koneksi antar pemain gagal. Coba ganti jaringan salah satu pemain (misalnya Wi-Fi ke data seluler).";
    if (
      ["network", "server-error", "socket-error", "socket-closed"].includes(
        e.type,
      )
    )
      return (
        "Tidak bisa menghubungi server PeerJS (" +
        e.type +
        "). Cek internet, matikan VPN atau ad-blocker, atau ganti jaringan, lalu coba lagi."
      );
    return "Gagal: " + e.type;
  };
  $("mk").onclick = () => {
    if (!ready()) return;
    isHost = true;
    if (peer) peer.destroy();
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let id = "";
    for (let i = 0; i < 4; i++) id += A[Math.floor(Math.random() * A.length)];
    $("lob").textContent = "Menghubungi server PeerJS...";
    peer = new Peer("desa-" + id);
    const to = setTimeout(() => {
      $("lob").textContent =
        "Server PeerJS tidak merespons setelah 10 detik. Matikan VPN atau ad-blocker, atau ganti jaringan, lalu klik Buat room lagi.";
    }, 10000);
    peer.on("open", () => {
      clearTimeout(to);
      $("lob").textContent =
        "Kode room: " +
        id +
        ". Kirim ke temanmu, game mulai otomatis begitu dia masuk.";
    });
    peer.on("connection", setup);
    peer.on("disconnected", () => peer.reconnect());
    peer.on("error", (e) => {
      clearTimeout(to);
      $("lob").textContent = perr(e);
    });
  };
  $("jn").onclick = () => {
    if (!ready()) return;
    isHost = false;
    const id = $("cd").value.trim().toUpperCase();
    if (id.length < 4) {
      $("lob").textContent = "Isi kode 4 huruf dari temanmu.";
      return;
    }
    if (peer) peer.destroy();
    $("lob").textContent = "Menghubungi server PeerJS...";
    peer = new Peer();
    const to = setTimeout(() => {
      if (!rp.g.visible)
        $("lob").textContent =
          "Belum tersambung setelah 12 detik. Pastikan temanmu sudah membuat room, kodenya benar, dan coba ganti jaringan kalau masih gagal.";
    }, 12000);
    peer.on("open", () => {
      $("lob").textContent = "Menyambung ke room " + id + "...";
      setup(peer.connect("desa-" + id));
    });
    peer.on("error", (e) => {
      clearTimeout(to);
      $("lob").textContent = perr(e);
    });
  };
  function net(dt) {
    if (conn && conn.open && running) {
      sendT -= dt;
      if (sendT <= 0) {
        sendT = 0.06;
        conn.send({
          t: "s",
          x: px,
          y: py,
          z: pz,
          f: face,
          w: Math.hypot(vx, vz),
          a: py > H(px, pz) + 0.1 ? 1 : 0,
        });
      }
    }
    if (!rp.g.visible) return;
    const g = rp.g,
      k = 1 - Math.exp(-12 * dt);
    g.position.x += (rpT.x - g.position.x) * k;
    g.position.y += (rpT.y - g.position.y) * k;
    g.position.z += (rpT.z - g.position.z) * k;
    let d = rpT.f - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * k;
    rpWalk += dt * rpT.w * 1.6;
    const sw = Math.sin(rpWalk) * Math.min(1, rpT.w / 6) * 0.9;
    if (rpT.a) {
      rp.aL.rotation.x = rp.aR.rotation.x = -2.4;
      rp.lL.rotation.x = 0.4;
      rp.lR.rotation.x = -0.4;
    } else {
      rp.aL.rotation.x = sw;
      rp.aR.rotation.x = -sw;
      rp.lL.rotation.x = -sw;
      rp.lR.rotation.x = sw;
    }
  }

  // ---------- Aksi: masuk rumah, ambil alat, tebang pohon, memancing ----------
  const inv = { axe: false, rod: false, wood: 0, fish: 0 },
    SPC = ["Ikan Mas", "Ikan Nila", "Ikan Lele", "Gurame", "Ikan Bawal"];
  const axeHeld = new THREE.Group();
  axeHeld.add(
    mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), woodM, 0, -1.1, 0.05),
    mesh(new THREE.BoxGeometry(0.06, 0.22, 0.4), steelM, 0, -1.6, 0.22),
  );
  axeHeld.visible = false;
  aR.add(axeHeld);
  const rodHeld = mesh(
    new THREE.CylinderGeometry(0.03, 0.05, 3, 5),
    woodM,
    0.45,
    2.2,
    1.1,
  );
  rodHeld.rotation.x = 1;
  rodHeld.visible = false;
  P.add(rodHeld);
  const lpos = new Float32Array(6),
    lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(lpos, 3));
  const lineM = new THREE.Line(
    lg,
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  );
  lineM.frustumCulled = false;
  lineM.visible = false;
  scene.add(lineM);
  const bobber = mesh(new THREE.SphereGeometry(0.14, 6, 5), M(0xff4a3a));
  bobber.visible = false;
  scene.add(bobber);
  const cfish = new THREE.Mesh(fishBody, FM[2]);
  cfish.scale.set(2.4, 0.9, 0.7);
  cfish.visible = false;
  scene.add(cfish);
  // HP: coba layar penuh + kunci mode miring (Android Chrome); iPhone cukup diputar manual
  if (window.matchMedia && matchMedia("(pointer:coarse)").matches)
    ["go", "mk", "jn"].forEach((id) =>
      $(id).addEventListener("click", () => {
        try {
          const d = document.documentElement;
          (d.requestFullscreen ? d.requestFullscreen() : Promise.resolve())
            .then(
              () =>
                screen.orientation &&
                screen.orientation.lock &&
                screen.orientation.lock("landscape"),
            )
            .catch(() => {});
        } catch (e) {}
      }),
    );
  const ab = $("act");
  ab.addEventListener("pointerdown", () => (keys.KeyE = true));
  ["pointerup", "pointercancel"].forEach((e) =>
    ab.addEventListener(e, () => (keys.KeyE = false)),
  );
  let fs = { st: 0, t: 0, bx: 0, bz: 0, ox: 0, oz: 0 },
    swing = 0,
    eHeld = false,
    cfT = 0,
    lastHint = "",
    lastInv = "",
    swingTree = null;
  // Tinggi lantai: di dalam rumah, pemain berdiri di atas lantai rumah (bukan tanah di bawahnya)
  function flr(x, z) {
    for (const h of hlist) {
      const c = Math.cos(h[2]),
        s = Math.sin(h[2]),
        dx = x - h[0],
        dz = z - h[1];
      if (Math.abs(dx * c - dz * s) < 3 && Math.abs(dx * s + dz * c) < 2.5)
        return h[5] + 0.04;
    }
    return H(x, z);
  }
  function act(dt) {
    fight(dt);
    let ins = -1;
    hlist.forEach((h, i) => {
      const c = Math.cos(h[2]),
        s = Math.sin(h[2]),
        dx = px - h[0],
        dz = pz - h[1];
      if (Math.abs(dx * c - dz * s) < 2.7 && Math.abs(dx * s + dz * c) < 2.3)
        ins = i;
    });
    hlist.forEach((h, i) => {
      h[3].opacity = i === ins ? 0.2 : 1;
      h[4].opacity = i === ins ? 0.06 : 1;
    });
    if (ins >= 0) lamp.intensity = Math.max(lamp.intensity, 1.8);
    if (running)
      picks.forEach((p) => {
        if (p.got || inv[p.tool] || Math.hypot(px - p.x, pz - p.z) > 1.6)
          return;
        p.got = true;
        p.it.visible = false;
        inv[p.tool] = true;
        beep(880, 0.12);
        toast(
          p.tool === "axe"
            ? "Dapat kampak! Dekati pohon lalu tekan E."
            : "Dapat alat pancing! Dekati sungai atau kolam lalu tekan E.",
        );
      });
    let tree = null,
      td = 3.4;
    if (inv.axe)
      trees.forEach((t) => {
        if (t.hp > 0) {
          const d = Math.hypot(px - t.x, pz - t.z);
          if (d < td) {
            td = d;
            tree = t;
          }
        }
      });
    const rd = Math.abs(pz - RZ(px)),
      pd = Math.hypot(px, pz + 34) - 7,
      nearW = inv.rod && px < 400 && ins < 0 && (rd < 6.5 || pd < 2.5);
    if (fs.st && Math.hypot(px - fs.ox, pz - fs.oz) > 2.5) {
      fs.st = 0;
      toast("Kamu menjauh, pancingan ditarik.");
    }
    if (keys.KeyE && !eHeld) {
      eHeld = true;
      if (running && !quizOn) {
        if (fs.st === 2) {
          fs.st = 0;
          inv.fish++;
          cfT = 0.001;
          const sp = SPC[Math.floor(rnd() * SPC.length)];
          beep(660, 0.1);
          setTimeout(() => beep(990, 0.2), 100);
          toast("Dapat " + sp + "! Total ikan: " + inv.fish);
          if (conn && conn.open) conn.send({ t: "f", n: myName, s: sp });
        } else if (fs.st === 1) {
          fs.st = 0;
          toast("Terlalu cepat, ikannya kabur.");
        } else if (tree) {
          swing = 0.45;
          swingTree = tree;
          face = Math.atan2(tree.x - px, tree.z - pz);
          tree.hp--;
          tree.shake = 0.3;
          if (conn && conn.open)
            conn.send({ t: "tr", i: trees.indexOf(tree), h: tree.hp });
          beep(110, 0.1, "square", 0.2);
          if (conn && conn.open) conn.send({ t: "t", i: trees.indexOf(tree) });
          if (tree.hp <= 0) {
            tree.fall = time;
            tree.sol[0] = tree.sol[1] = 1e5;
            inv.wood += 2;
            toast("Pohon tumbang! Kayu +2");
          }
        } else if (nearW) {
          const tx = pd < rd - 3.5 ? 0 : px,
            tz = pd < rd - 3.5 ? -34 : RZ(px);
          let dx = tx - px,
            dz = tz - pz,
            dl = Math.hypot(dx, dz);
          if (dl < 0.6) {
            dx = Math.sin(face);
            dz = Math.cos(face);
            dl = 1;
          }
          const rc = Math.min(dl, 3.4);
          fs = {
            st: 1,
            t: rr(2, 5),
            bx: px + (dx / dl) * rc,
            bz: pz + (dz / dl) * rc,
            ox: px,
            oz: pz,
          };
          face = Math.atan2(dx, dz);
          toast("Kail dilempar. Tunggu ikan menggigit...");
        }
      }
    }
    if (!keys.KeyE) eHeld = false;
    if (fs.st) {
      fs.t -= dt;
      const wy =
        Math.hypot(fs.bx, fs.bz + 34) < 8 ? water.position.y + 0.03 : -0.33;
      if (fs.st === 1 && fs.t <= 0) {
        fs.st = 2;
        fs.t = 1;
        beep(740, 0.15);
        toast("Ikan menggigit! Tekan E!");
      } else if (fs.st === 2 && fs.t <= 0) {
        fs.st = 0;
        toast("Ikannya lepas. Coba lagi.");
      }
      bobber.position.set(
        fs.bx,
        wy +
          (fs.st === 2
            ? -0.2 + Math.sin(time * 40) * 0.05
            : Math.sin(time * 3) * 0.03),
        fs.bz,
      );
      const c = Math.cos(face),
        s = Math.sin(face);
      lpos.set([
        px + 0.45 * c + 2.92 * s,
        py + 3.02,
        pz - 0.45 * s + 2.92 * c,
        fs.bx,
        bobber.position.y,
        fs.bz,
      ]);
      lg.attributes.position.needsUpdate = true;
    }
    const fishing = fs.st > 0;
    rodHeld.visible = bobber.visible = lineM.visible = fishing;
    axeHeld.visible = inv.axe && !fishing;
    if (swing > 0) {
      swing -= dt;
      aR.rotation.x = -2.8 + (1 - swing / 0.45) * 2.2;
      aL.rotation.x = aR.rotation.x * 0.5;
    }
    if (fishing) aR.rotation.x = aL.rotation.x = -1.1;
    if (cfT > 0) {
      cfT += dt / 0.8;
      if (cfT >= 1) {
        cfT = 0;
        cfish.visible = false;
      } else {
        cfish.visible = true;
        cfish.position.set(
          fs.bx + (px - fs.bx) * cfT,
          -0.2 + cfT * (py + 1.8) + Math.sin(cfT * Math.PI) * 1.5,
          fs.bz + (pz - fs.bz) * cfT,
        );
        cfish.rotation.z = cfT * 12;
      }
    }
    trees.forEach((t) => {
      if (t.shake > 0) {
        t.shake -= dt;
        t.g.rotation.x = (Math.sin(time * 45) * 0.05 * t.shake) / 0.3;
      }
      if (t.fall)
        t.g.rotation.z = Math.min(1, (time - t.fall) / 0.9) ** 2 * 1.5;
    });
    const hint =
      !running || quizOn
        ? ""
        : fs.st === 2
          ? "TEKAN E SEKARANG!"
          : fs.st === 1
            ? "Tunggu ikan menggigit... (E: tarik)"
            : tree
              ? "E: tebang pohon"
              : nearW
                ? "E: mulai memancing"
                : "";
    if (hint !== lastHint) {
      lastHint = hint;
      $("hint").textContent = hint;
      $("hint").style.display = hint ? "block" : "none";
    }
    const iv =
      "Kampak " +
      (inv.axe ? "ada" : "-") +
      "  Pancing " +
      (inv.rod ? "ada" : "-") +
      "  Kayu " +
      inv.wood +
      "  Ikan " +
      inv.fish;
    if (iv !== lastInv) {
      lastInv = iv;
      $("inv").textContent = iv;
    }
  }

  // ---------- Gua harta karun, istana, zombi, dan Raja Terakhir ----------
  const BX = 500,
    CAVE = { x: 0, z: -95 },
    CHEST = { x: BX, z: -79 },
    skyTex = scene.background,
    caveBg = new THREE.Color(0x0b0710);
  const darkM = new THREE.MeshBasicMaterial({ color: 0x050308 }),
    stoneD = M(0x2d2a33),
    stoneL = M(0x6b6478),
    carpM = M(0x8a1f2a),
    goldM = M(0xe0b030, {
      emissive: 0x8a6000,
      emissiveIntensity: 0.8,
      metalness: 0.6,
      roughness: 0.35,
    }),
    flameM = new THREE.MeshBasicMaterial({ color: 0xff9a30 }),
    cwd = M(0x6b3a1a);
  const gy = H(0, -98);
  [
    [-7.5, 3, -96, 5, 6, 5],
    [7.5, 3, -96, 5, 6, 5],
    [0, 4.5, -103, 8, 9, 7],
    [0, 6.8, -96, 4, 2.2, 3.4],
    [-13, 2, -103, 5, 4, 5],
    [13, 2, -103, 5, 4, 5],
  ].forEach(([x, y, z, a, b, c], i) => {
    const r = mesh(rockG, i % 2 ? rockM : stoneL, x, gy + y, z);
    r.scale.set(a, b, c);
    r.rotation.y = rr(0, 3);
    scene.add(r);
  });
  scene.add(
    mesh(new THREE.BoxGeometry(4.4, 4.2, 0.5), darkM, 0, gy + 2.1, -97),
  );
  [-2.6, 2.6].forEach((x) => {
    scene.add(
      mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.8, 5),
        cwd,
        x,
        gy + 1.5,
        -94.4,
      ),
    );
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 5), flameM);
    f.position.set(x, gy + 2.5, -94.4);
    scene.add(f);
  });
  [
    [-7.5, -96, 4.6],
    [7.5, -96, 4.6],
    [0, -103, 6.5],
    [-13, -103, 4],
    [13, -103, 4],
  ].forEach((o) => solids.push(o));
  trees.forEach((t) => {
    if (Math.hypot(t.x, t.z + 99) < 16 && t.hp > 0) {
      t.hp = 0;
      t.g.visible = false;
      t.sol[0] = t.sol[1] = 1e5;
    }
  });
  const bx = (w, h, d, m, x, y, z) =>
    scene.add(mesh(new THREE.BoxGeometry(w, h, d), m, BX + x, y, z));
  bx(8, 0.2, 44, stoneD, 0, -0.1, 12);
  bx(24, 0.2, 74, stoneD, 0, -0.1, -47);
  bx(8, 0.3, 44, stoneD, 0, 5, 12);
  bx(24, 0.3, 74, stoneD, 0, 9.6, -47);
  bx(0.5, 5, 44, stoneD, -4.25, 2.5, 12);
  bx(0.5, 5, 44, stoneD, 4.25, 2.5, 12);
  bx(8.5, 5, 0.5, stoneD, 0, 2.5, 34.25);
  bx(0.5, 9.6, 74, stoneL, -12.25, 4.8, -47);
  bx(0.5, 9.6, 74, stoneL, 12.25, 4.8, -47);
  bx(24.5, 9.6, 0.5, stoneL, 0, 4.8, -84.25);
  bx(8, 9.6, 0.5, stoneL, -8, 4.8, -10);
  bx(8, 9.6, 0.5, stoneL, 8, 4.8, -10);
  bx(8, 4.6, 0.5, stoneL, 0, 7.3, -10);
  bx(3, 0.03, 70, carpM, 0, 0.02, -47);
  const pilG = new THREE.CylinderGeometry(0.7, 0.8, 9.6, 8),
    flG = new THREE.SphereGeometry(0.22, 6, 5);
  [-18, -28, -38, -58, -68, -78].forEach((z) =>
    [-6.5, 6.5].forEach((x) => {
      scene.add(mesh(pilG, stoneL, BX + x, 4.8, z));
      solids.push([BX + x, z, 0.85]);
      const f = new THREE.Mesh(flG, flameM);
      f.position.set(BX + x * 0.87, 3.2, z);
      scene.add(f);
    }),
  );
  bx(5, 0.5, 3.4, stoneL, 0, 0.25, -81.5);
  bx(1.8, 1.6, 1.2, goldM, 0, 1.3, -82);
  bx(2, 3.4, 0.3, goldM, 0, 2.6, -83.3);
  const chest = new THREE.Group();
  chest.add(
    mesh(new THREE.BoxGeometry(1.5, 0.8, 1), cwd, 0, 0.4, 0),
    mesh(new THREE.BoxGeometry(1.6, 0.35, 1.1), goldM, 0, 0.95, 0),
  );
  for (let i = 0; i < 9; i++)
    chest.add(
      mesh(
        new THREE.SphereGeometry(0.2, 6, 5),
        goldM,
        rr(-0.6, 0.6),
        1.2 + rr(0, 0.15),
        rr(-0.4, 0.4),
      ),
    );
  chest.position.set(CHEST.x, 0, CHEST.z);
  scene.add(chest);
  solids.push([CHEST.x, CHEST.z, 1.1]);

  const Z = [],
    pl = { hp: 100, cd: 0, hurt: 0 };
  function spawnZ(x, z) {
    const v = villager(x, z, 0x4a4036, 0x2a2a2a, 0x2f2f3a, 1, 0x6f9a5a);
    v.aL.rotation.x = v.aR.rotation.x = -1.5;
    Z.push({ v, hp: 60, hit: rr(0, 1), dead: 0, go: false, sp: rr(2, 2.8) });
  }
  for (let i = 0; i < 8; i++) spawnZ(BX + rr(-9, 9), rr(-44, -16));
  for (let i = 0; i < 4; i++) spawnZ(BX + rr(-9, 9), rr(-60, -50));
  const boss = villager(BX, -68, 0x5b2a86, 0xe0b030, 0x2a1a3a, 1.9, 0xbfc9a0),
    B = { hp: 260, max: 260, on: false, dead: 0, cd: 1.5, wind: 0, sum: false };
  boss.V.add(
    mesh(new THREE.BoxGeometry(0.9, 1.5, 0.08), M(0xa02020), 0, 1.2, -0.5),
  );
  boss.aR.add(
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 5), woodM, 0, -1.3, 0),
    mesh(new THREE.BoxGeometry(0.1, 0.9, 0.3), steelM, 0, -2.2, 0.1),
  );
  const clampXZ = (x, z) => {
    const hx = z > -10 ? 3.4 : 11.4;
    return [
      BX + Math.max(-hx, Math.min(hx, x - BX)),
      Math.max(-83.4, Math.min(34.2, z)),
    ];
  };
  let fH = false,
    qH = false,
    wasIn = false,
    lockT = 0;
  const atk = $("atk");
  atk.addEventListener("pointerdown", () => (keys.KeyF = true));
  ["pointerup", "pointercancel"].forEach((e) =>
    atk.addEventListener(e, () => (keys.KeyF = false)),
  );
  function tele(x, z, yw, fc) {
    px = x;
    pz = z;
    vx = vz = 0;
    yaw = yw;
    face = fc;
    cam.position.set(x + Math.sin(yw) * 6, 3, z + Math.cos(yw) * 6);
    const f = $("fade");
    f.style.transition = "none";
    f.style.opacity = 1;
    setTimeout(() => {
      f.style.transition = "opacity .6s";
      f.style.opacity = 0;
    }, 80);
  }
  function hurt(n) {
    pl.hp -= n;
    pl.hurt = 0.35;
    beep(100, 0.15, "sawtooth");
    if (pl.hp <= 0) {
      pl.hp = 100;
      B.hp = B.max;
      B.on = false;
      B.sum = false;
      toast("Kamu pingsan dan dibawa keluar gua.");
      tele(0, -91, Math.PI, 0);
    }
  }
  function fight(dt) {
    const inC = px > 400;
    if (inC !== wasIn) {
      wasIn = inC;
      scene.fog.near = inC ? 4 : 30;
      scene.fog.far = inC ? 60 : 140;
      scene.background = inC ? caveBg : skyTex;
      $("map").style.display = inC ? "none" : "block";
    }
    if (inC) {
      scene.fog.color.setHex(0x0b0710);
      sun.intensity = 0;
      hemi.intensity = 0.4;
      lamp.intensity = 3.2;
      stars.material.opacity = 0;
    }
    pl.cd -= dt;
    pl.hurt -= dt;
    $("hurt").style.opacity = Math.max(0, pl.hurt / 0.35);
    $("hpf").style.width = Math.max(0, pl.hp) + "%";
    if (running && !inC && pz < -95.2 && pz > -98 && Math.abs(px) < 2.4) {
      tele(BX, 29, 0, Math.PI);
      if (stage < 1) {
        stage = 1;
        $("mt").textContent =
          "Kalahkan zombi di istana lalu hadapi Raja Terakhir. F: serang, Q: makan ikan.";
      }
      toast("Kamu memasuki gua harta karun...");
    }
    if (running && inC && pz > 33.6) tele(0, -91, Math.PI, 0);
    if (keys.KeyQ && !qH) {
      qH = true;
      if (inv.fish > 0 && pl.hp < 100) {
        inv.fish--;
        pl.hp = Math.min(100, pl.hp + 30);
        beep(520, 0.15);
        toast("Makan ikan, tenaga pulih +30");
      }
    }
    if (!keys.KeyQ) qH = false;
    if (keys.KeyF && !fH) {
      fH = true;
      if (running && !quizOn && pl.cd <= 0) {
        pl.cd = 0.45;
        swing = 0.45;
        beep(180, 0.08, "square", 0.15);
        const dmg = inv.axe ? 25 : 8;
        const hit = (x, z, r) => {
          const dx = x - px,
            dz = z - pz;
          return (
            Math.hypot(dx, dz) < r &&
            dx * Math.sin(face) + dz * Math.cos(face) > 0
          );
        };
        Z.forEach((o) => {
          const p = o.v.g.position;
          if (!o.dead && hit(p.x, p.z, 2.8)) {
            o.hp -= dmg;
            o.go = true;
            p.x += (p.x - px) * 0.15;
            p.z += (p.z - pz) * 0.15;
            if (o.hp <= 0) o.dead = time;
          }
        });
        if (!B.dead && hit(boss.g.position.x, boss.g.position.z, 4)) {
          B.hp -= dmg;
          B.on = true;
          if (B.hp <= 0) {
            B.dead = time;
            stage = 2;
            $("mt").textContent =
              "Raja Terakhir kalah. Buka peti harta karun di depan singgasana.";
            toast("Raja Terakhir tumbang! Buka peti harta karun.");
          }
        }
      }
    }
    if (!keys.KeyF) fH = false;
    Z.forEach((o, i) => {
      const g = o.v.g,
        p = g.position;
      if (o.dead) {
        g.rotation.x = -Math.min(1, (time - o.dead) / 0.6) * 1.5;
        if (time - o.dead > 4) g.visible = false;
        return;
      }
      const dx = px - p.x,
        dz = pz - p.z,
        d = Math.hypot(dx, dz);
      if (inC && d < 13) o.go = true;
      if (!o.go || !inC) {
        o.v.V.rotation.z = Math.sin(time * 1.5 + i) * 0.06;
        return;
      }
      g.rotation.y = Math.atan2(dx, dz);
      if (d > 1.3) {
        p.x += (dx / d) * o.sp * dt;
        p.z += (dz / d) * o.sp * dt;
        const w = Math.sin(time * 6 + i) * 0.6;
        o.v.lL.rotation.x = w;
        o.v.lR.rotation.x = -w;
      }
      o.hit -= dt;
      if (d < 1.6 && o.hit <= 0 && running) {
        o.hit = 1.1;
        hurt(8);
      }
      const c = clampXZ(p.x, p.z);
      p.x = c[0];
      p.z = c[1];
    });
    const bp = boss.g.position,
      bdx = px - bp.x,
      bdz = pz - bp.z,
      bd = Math.hypot(bdx, bdz);
    if (!B.dead) {
      if (inC && bd < 24 && pz < -45) B.on = true;
      $("boss").style.display = B.on && inC ? "block" : "none";
      $("bossf").style.width = Math.max(0, (B.hp / B.max) * 100) + "%";
      if (B.on && inC) {
        boss.g.rotation.y = Math.atan2(bdx, bdz);
        if (bd > 3) {
          const sp = B.hp < B.max / 2 ? 4 : 2.8,
            w = Math.sin(time * 5) * 0.5;
          bp.x += (bdx / bd) * sp * dt;
          bp.z += (bdz / bd) * sp * dt;
          boss.lL.rotation.x = w;
          boss.lR.rotation.x = -w;
        }
        B.cd -= dt;
        if (B.wind > 0) {
          B.wind -= dt;
          boss.aR.rotation.x = -2.6 + (1 - B.wind / 0.5) * 2.4;
          if (B.wind <= 0 && bd < 4.2) hurt(18);
        } else if (bd < 3.6 && B.cd <= 0) {
          B.cd = 1.8;
          B.wind = 0.5;
        }
        if (!B.sum && B.hp < B.max / 2) {
          B.sum = true;
          for (let k = 0; k < 3; k++)
            spawnZ(bp.x + rr(-4, 4), bp.z + rr(-4, 4));
          toast("Sang raja memanggil pasukan zombi!");
        }
        const c = clampXZ(bp.x, bp.z);
        bp.x = c[0];
        bp.z = c[1];
      }
    } else {
      boss.g.rotation.x = -Math.min(1, (time - B.dead) / 1) * 1.5;
      $("boss").style.display = "none";
    }
    goldM.emissiveIntensity = stage >= 2 ? 1.6 + Math.sin(time * 4) * 0.4 : 0.8;
    if (
      running &&
      stage < 2 &&
      inC &&
      time > lockT &&
      Math.hypot(px - CHEST.x, pz - CHEST.z) < 2.6
    ) {
      lockT = time + 4;
      toast("Peti terkunci oleh kutukan sang raja.");
    }
  }

  // ---------- Loop ----------
  let running = false,
    px = 0,
    pz = 9,
    py = H(0, 9),
    vx = 0,
    vz = 0,
    vy = 0,
    face = Math.PI,
    walk = 0,
    score = 0,
    stage = 0,
    time = 0;
  const clock = new THREE.Clock();
  $("go").onclick = () => {
    $("start").classList.add("hidden");
    running = true;
    t0 = time;
    toast("Titik kuning di peta adalah koin. Ikuti juga pilar cahaya kuning.");
  };

  // ---------- Peta mini (atas = arah kamera) ----------
  const mctx = $("map").getContext("2d"),
    MS = 170,
    MR = 60,
    houses = hlist;
  function drawMap() {
    const c = mctx,
      h = MS / 2,
      k = h / MR,
      sy = Math.sin(yaw),
      cy = Math.cos(yaw);
    const pt = (x, z) => {
      const dx = x - px,
        dz = z - pz;
      return [dx * cy - dz * sy, dx * sy + dz * cy];
    }; // [kanan, mundur]
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, MS, MS);
    c.save();
    c.beginPath();
    c.arc(h, h, h - 3, 0, 6.283);
    c.clip();
    c.translate(h, h);
    c.fillStyle = "#2f5b3a55";
    c.fillRect(-h, -h, MS, MS);
    c.strokeStyle = "#5fb3d9";
    c.lineWidth = 8 * k;
    c.beginPath();
    for (let X = -110; X <= 110; X += 5) {
      const [a, b] = pt(X, RZ(X));
      X < -105 ? c.moveTo(a * k, b * k) : c.lineTo(a * k, b * k);
    }
    c.stroke();
    c.fillStyle = "#d9c29a";
    houses.forEach((o) => {
      const [x, y] = pt(o[0], o[1]);
      c.fillRect(x * k - 4, y * k - 4, 8, 8);
    });
    const [kx, ky] = pt(0, 0);
    c.fillStyle = stage ? "#55f0ff" : "#8a8a99";
    c.beginPath();
    c.moveTo(kx * k, ky * k - 6);
    c.lineTo(kx * k + 5, ky * k);
    c.lineTo(kx * k, ky * k + 6);
    c.lineTo(kx * k - 5, ky * k);
    c.fill();
    if (rp.g.visible) {
      const [fx2, fy2] = pt(rp.g.position.x, rp.g.position.z);
      let X = fx2 * k,
        Y = fy2 * k;
      const dd = Math.hypot(X, Y);
      if (dd > h - 10) {
        X *= (h - 10) / dd;
        Y *= (h - 10) / dd;
      }
      c.fillStyle = "#4db8ff";
      c.strokeStyle = "#fff";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(X, Y, 4.5, 0, 6.283);
      c.fill();
      c.stroke();
    }
    {
      const [cx2, cy2] = pt(CAVE.x, CAVE.z);
      let CX = cx2 * k,
        CY = cy2 * k;
      const cd2 = Math.hypot(CX, CY);
      if (cd2 > h - 10) {
        CX *= (h - 10) / cd2;
        CY *= (h - 10) / cd2;
      }
      c.fillStyle = "#c0803a";
      c.strokeStyle = "#fff";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(CX, CY - 7);
      c.lineTo(CX + 6, CY + 5);
      c.lineTo(CX - 6, CY + 5);
      c.closePath();
      c.fill();
      c.stroke();
    }
    coins.forEach((o) => {
      if (!o.g.visible) return;
      let [x, y] = pt(o.g.position.x, o.g.position.z);
      x *= k;
      y *= k;
      const d = Math.hypot(x, y),
        far = d > h - 10;
      if (far) {
        x *= (h - 10) / d;
        y *= (h - 10) / d;
      }
      c.fillStyle = "#ffd23a";
      c.strokeStyle = "#7a4a00";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(x, y, far ? 3 : 4.5, 0, 6.283);
      c.fill();
      c.stroke();
    });
    c.rotate(Math.PI - (face - yaw));
    c.fillStyle = "#fff";
    c.strokeStyle = "#d9503f";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -8);
    c.lineTo(6, 7);
    c.lineTo(0, 3);
    c.lineTo(-6, 7);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }

  // ---------- Kuis: jawaban benar = indeks 0 (urutan diacak saat ditampilkan) ----------
  const QZ = [
    ["Berapa hasil 7 x 8?", ["56", "54", "58"]],
    [
      "Planet yang paling dekat dengan Matahari?",
      ["Merkurius", "Venus", "Mars"],
    ],
    [
      "Tumbuhan membuat makanan sendiri lewat proses?",
      ["Fotosintesis", "Respirasi", "Evaporasi"],
    ],
    ["Padi yang dipanen dan digiling menjadi?", ["Beras", "Jagung", "Gula"]],
    [
      "Alat musik bambu tradisional dari Jawa Barat?",
      ["Angklung", "Sasando", "Tifa"],
    ],
    [
      "Campuran warna biru dan kuning menghasilkan?",
      ["Hijau", "Ungu", "Oranye"],
    ],
    ['Bahasa Inggris dari "pohon" adalah?', ["Tree", "Rock", "House"]],
    [
      "Air membeku pada suhu berapa?",
      ["0 derajat Celsius", "50 derajat Celsius", "100 derajat Celsius"],
    ],
    ["Berapa hasil 15 + 27?", ["42", "41", "43"]],
    [
      "Lambang sila pertama Pancasila?",
      ["Bintang", "Rantai", "Pohon beringin"],
    ],
    ["Bahan utama pembuatan tempe?", ["Kedelai", "Singkong", "Kentang"]],
    [
      "Hewan berikut yang bertelur dan bisa terbang?",
      ["Burung", "Sapi", "Kambing"],
    ],
    ["Ibu kota Provinsi Jawa Barat adalah?", ["Bandung", "Bogor", "Bekasi"]],
    ["Berapa hasil 9 x 6?", ["54", "56", "48"]],
    [
      "Bagian tumbuhan yang menyerap air dari tanah?",
      ["Akar", "Daun", "Bunga"],
    ],
    ["Hewan yang bernapas dengan insang?", ["Ikan", "Kucing", "Burung"]],
    ["Rumah adat Minangkabau disebut?", ["Rumah Gadang", "Joglo", "Honai"]],
    ["Berapa hasil 100 - 37?", ["63", "67", "73"]],
    ["Benda langit yang mengelilingi Bumi?", ["Bulan", "Mars", "Matahari"]],
  ];
  let quizOn = false,
    bag = [];
  function ask(c) {
    if (!bag.length) bag = QZ.map((_, i) => i).sort(() => rnd() - 0.5);
    const [q, o] = QZ[bag.pop()],
      box = $("opts");
    quizOn = true;
    vx = vz = 0;
    keys.Space = false;
    jr();
    $("qq").textContent = q;
    box.innerHTML = "";
    o.map((t, i) => [t, i])
      .sort(() => rnd() - 0.5)
      .forEach(([t, i]) => {
        const b = document.createElement("button");
        b.className = "opt";
        b.textContent = t;
        b.onclick = () => {
          $("quiz").classList.add("hidden");
          quizOn = false;
          if (i === 0) {
            c.ok = true;
            beep(660, 0.12);
            setTimeout(() => beep(990, 0.22), 110);
          } else {
            c.cd = time + 4;
            beep(150, 0.35, "sawtooth");
            toast("Jawaban salah. Koin menghilang sebentar, coba lagi nanti.");
          }
        };
        box.appendChild(b);
      });
    $("quiz").classList.remove("hidden");
  }

  function update(dt) {
    if (quizOn) return;
    const fx = Math.max(
      -1,
      Math.min(
        1,
        (keys.KeyD || keys.ArrowRight ? 1 : 0) -
          (keys.KeyA || keys.ArrowLeft ? 1 : 0) +
          joyX,
      ),
    );
    const fz = Math.max(
      -1,
      Math.min(
        1,
        (keys.KeyW || keys.ArrowUp ? 1 : 0) -
          (keys.KeyS || keys.ArrowDown ? 1 : 0) -
          joyY,
      ),
    );
    const sy = Math.sin(yaw),
      cy = Math.cos(yaw);
    let mx = -sy * fz + cy * fx,
      mz = -cy * fz - sy * fx;
    const l = Math.hypot(mx, mz);
    if (l > 1) {
      mx /= l;
      mz /= l;
    }
    const wade =
        px < 400 && Math.abs(pz - RZ(px)) < 4 && Math.abs(px) > 1.6 ? 0.6 : 1,
      sp = (keys.ShiftLeft || keys.ShiftRight ? 11 : 7) * wade,
      k = 1 - Math.exp(-10 * dt);
    vx += (mx * sp - vx) * k;
    vz += (mz * sp - vz) * k;
    px += vx * dt;
    pz += vz * dt;
    for (const o of solids) {
      const dx = px - o[0],
        dz = pz - o[1],
        d = Math.hypot(dx, dz),
        m = o[2] + 0.45;
      if (d < m && d > 0) {
        px = o[0] + (dx / d) * m;
        pz = o[1] + (dz / d) * m;
      }
    }
    const rd = Math.hypot(px, pz);
    if (px < 400 && rd > 122) {
      px *= 122 / rd;
      pz *= 122 / rd;
    }
    if (px > 400) [px, pz] = clampXZ(px, pz);
    const gy = flr(px, pz),
      ground = py <= gy + 0.05 && vy <= 0;
    if (ground && keys.Space) vy = 10;
    vy -= 28 * dt;
    py += vy * dt;
    if (py <= gy) {
      py = gy;
      vy = 0;
    }
    const spd = Math.hypot(vx, vz);
    if (spd > 0.4) {
      let d = Math.atan2(vx, vz) - face;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      face += d * (1 - Math.exp(-12 * dt));
    }
    walk += dt * spd * 1.6;
    const sw = Math.sin(walk) * Math.min(1, spd / 6) * 0.9;
    if (ground) {
      aL.rotation.x = sw;
      aR.rotation.x = -sw;
      lL.rotation.x = -sw;
      lR.rotation.x = sw;
      V.position.y = Math.abs(Math.sin(walk)) * 0.08 * Math.min(1, spd / 6);
    } else {
      aL.rotation.x = aR.rotation.x = -2.4;
      lL.rotation.x = 0.4;
      lR.rotation.x = -0.4;
      V.position.y = 0;
    }
    P.position.set(px, py, pz);
    P.rotation.y = face;

    const inC = px > 400,
      cd = inC ? 6 : 9;
    let cx = px + Math.sin(yaw) * Math.cos(pitch) * cd,
      cz = pz + Math.cos(yaw) * Math.cos(pitch) * cd,
      cyy = Math.max(py + 1.6 + Math.sin(pitch) * cd, H(cx, cz) + 1);
    if (inC) {
      const hx = pz > -10 ? 3.5 : 11.5;
      cx = BX + Math.max(-hx, Math.min(hx, cx - BX));
      cz = Math.max(-83.5, Math.min(34, cz));
      cyy = Math.min(cyy, pz > -10 ? 4.3 : 8.5);
    }
    cam.position.lerp(new THREE.Vector3(cx, cyy, cz), 1 - Math.exp(-8 * dt));
    cam.lookAt(px, py + 1.6, pz);
    sun.position.set(px + SUNDIR.x, py + SUNDIR.y, pz + SUNDIR.z);
    sun.target.position.set(px, py, pz);

    coins.forEach((c, i) => {
      if (!c.g.visible) return;
      c.g.rotation.y += dt * 2.2;
      c.g.position.y = c.y0 + Math.sin(time * 2 + i) * 0.2;
      if (
        !c.ok &&
        time > (c.cd || 0) &&
        Math.hypot(c.g.position.x - px, c.g.position.z - pz) < 1.4 &&
        Math.abs(c.g.position.y - py - 1) < 2.5
      )
        ask(c);
      if (c.ok) {
        c.g.visible = false;
        score++;
        $("sc").textContent = score;
        if (conn && conn.open && !c.remote)
          conn.send({ t: "c", i: coins.indexOf(c) });
        if (score === 4) toast("Terdengar bisikan dari balik pepohonan...");
        else if (score === 8)
          toast("Kabut menebal. Kristal di tengah desa bergetar.");
        else if (score < 12) toast("Koin Kuno ditemukan");
      }
    });
    drawMap();
    if (score === 12 && stage === 0) {
      stage = 1;
      crystalM.color.set(0x40e0ff);
      crystalM.emissive.set(0x1aa0c0);
      crystalM.emissiveIntensity = 1.3;
      cLight.intensity = 2.5;
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 40, 8),
        new THREE.MeshBasicMaterial({
          color: 0x66f0ff,
          transparent: true,
          opacity: 0.35,
        }),
      );
      b.position.set(0, 20, 0);
      scene.add(b);
      $("mt").textContent =
        "Semua koin terkumpul. Sentuh kristal biru di tengah desa.";
      toast("Kristal di tengah desa bersinar!");
    }
    if (stage === 2 && Math.hypot(px - CHEST.x, pz - CHEST.z) < 2.6) {
      stage = 2;
      running = false;
      if (conn && conn.open) conn.send({ t: "w" });
      const sc2 = time - t0;
      let bst = sc2;
      try {
        bst = Math.min(sc2, +localStorage.getItem("desaBest") || sc2);
        localStorage.setItem("desaBest", bst);
      } catch (e) {}
      $("res").textContent =
        "Waktumu " +
        fmt(sc2) +
        ". Rekor terbaikmu " +
        fmt(bst) +
        ". Ikan: " +
        inv.fish +
        ", kayu: " +
        inv.wood +
        ".";
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => beep(f, 0.5), i * 140),
      );
      $("end").classList.remove("hidden");
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;
    if (running) update(dt);
    else {
      const a = time * 0.1;
      cam.position.set(Math.sin(a) * 22, 9, 9 + Math.cos(a) * 22);
      cam.lookAt(0, 3, 0);
    }
    extras(dt);
    crystal.rotation.y += dt * (stage ? 1.5 : 0.3);
    clouds.forEach((c) => {
      c.position.x += dt * 0.8;
      if (c.position.x > 140) c.position.x = -140;
    });
    flies.position.y = Math.sin(time) * 0.4;
    flies.rotation.y += dt * 0.02;
    disc.position
      .copy(cam.position)
      .addScaledVector(SUNDIR.clone().normalize(), 250);
    renderer.render(scene, cam);
  }
  frame();
})();
