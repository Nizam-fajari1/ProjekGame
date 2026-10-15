(() => {
const $ = id => document.getElementById(id);
let s = 11; const rnd = () => (s = s * 16807 % 2147483647) / 2147483647;
const rr = (a, b) => a + rnd() * (b - a);
const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: .9 }, o));
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };

// ---------- Renderer, langit, kabut, cahaya ----------
const cvs = $('game');
const renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene();
const FOG = 0xf0b68a;
scene.fog = new THREE.Fog(FOG, 30, 140);
const sk = document.createElement('canvas'); sk.width = 2; sk.height = 256;
const sx = sk.getContext('2d'), gr = sx.createLinearGradient(0, 0, 0, 256);
gr.addColorStop(0, '#4a5fa8'); gr.addColorStop(.5, '#d98fa0'); gr.addColorStop(.8, '#f0b68a'); gr.addColorStop(1, '#f0b68a');
sx.fillStyle = gr; sx.fillRect(0, 0, 2, 256);
scene.background = new THREE.CanvasTexture(sk);
const cam = new THREE.PerspectiveCamera(60, 1, .1, 300);
const resize = () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

const hemi = new THREE.HemisphereLight(0xffd2b0, 0x3f6b3a, .75); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffb878, 1.25);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0005;
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 160 });
scene.add(sun, sun.target);
const SUNDIR = new THREE.Vector3(55, 26, 28);
const disc = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe0a0, fog: false }));
scene.add(disc);

// ---------- Terrain ----------
const H = (x, z) => { const k = Math.min(1, Math.max(0, (Math.hypot(x, z) - 30) / 30)); return k * k * (Math.sin(x * .07) * 3 + Math.cos(z * .06) * 3 + Math.sin((x + z) * .15)); };
const gg = new THREE.PlaneGeometry(260, 260, 130, 130); gg.rotateX(-Math.PI / 2);
const gp = gg.attributes.position, gc = [], c1 = new THREE.Color(0x5a9a43), c2 = new THREE.Color(0x88bb52);
for (let i = 0; i < gp.count; i++) { gp.setY(i, H(gp.getX(i), gp.getZ(i))); gc.push(...c1.clone().lerp(c2, rnd()).toArray()); }
gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3)); gg.computeVertexNormals();
const ground = new THREE.Mesh(gg, M(0xffffff, { vertexColors: true })); ground.receiveShadow = true; scene.add(ground);

// ---------- Objek dunia ----------
const solids = [], segs = [], wins = [], chim = []; // solids: [x, z, radius]
const nearPath = (x, z) => segs.some(([a, b]) => { const t = Math.max(0, Math.min(1, (x * a + z * b) / (a * a + b * b))); return Math.hypot(x - a * t, z - b * t) < 2.5; });
const free = (x, z, r) => Math.hypot(x, z) > 7 && !nearPath(x, z) && solids.every(o => Math.hypot(o[0] - x, o[1] - z) > o[2] + r);

const stoneG = new THREE.CylinderGeometry(.9, 1, .12, 7), stoneM = M(0xb89c74);
function path(x, z) {
  segs.push([x, z]);
  const n = Math.ceil(Math.hypot(x, z) / 1.7);
  for (let i = 1; i <= n; i++) { const t = i / n, px = x * t + rr(-.3, .3), pz = z * t + rr(-.3, .3); const m = mesh(stoneG, stoneM, px, H(px, pz) + .05, pz); m.rotation.y = rr(0, 3); m.scale.setScalar(rr(.8, 1.2)); scene.add(m); }
}
function house(x, z, wall, roof) {
  const ry = Math.atan2(-x, -z), g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(6, 3.6, 5), M(wall), 0, 1.8, 0));
  const r = mesh(new THREE.ConeGeometry(4.9, 2.7, 4), M(roof), 0, 4.95, 0); r.rotation.y = Math.PI / 4; r.scale.z = .85; g.add(r);
  g.add(mesh(new THREE.BoxGeometry(1.2, 2.2, .12), M(0x5a3a22), 0, 1.1, 2.52));
  [-2, 2].forEach(wx => { const wm = M(0xffe9a8, { emissive: 0xffb84a, emissiveIntensity: .7 }); wins.push(wm); g.add(mesh(new THREE.BoxGeometry(1, 1, .12), wm, wx, 2.2, 2.52)); });
  g.add(mesh(new THREE.BoxGeometry(.9, 2, .9), M(0x8a8078), 1.8, 4.8, -1));
  g.position.set(x, H(x, z), z); g.rotation.y = ry; scene.add(g);
  chim.push([x + 1.8 * Math.cos(ry) - Math.sin(ry), H(x, z) + 5.9, z - 1.8 * Math.sin(ry) - Math.cos(ry)]);
  [-2, 0, 2].forEach(o => solids.push([x + Math.cos(ry) * o, z - Math.sin(ry) * o, 2.4]));
  path(x + Math.sin(ry) * 3.8, z + Math.cos(ry) * 3.8);
}
house(-15, -14, 0xe8d5b0, 0xb5452f); house(17, -12, 0xd9e3c4, 0x4f6d8c);
house(-20, 12, 0xf0c9a0, 0x6b4a8c); house(19, 17, 0xe9e1d0, 0x8a3b3b);

const postG = new THREE.BoxGeometry(.25, 1.3, .25), fm = M(0x8a5a33);
function fence(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), n = Math.round(L / 1.2), th = Math.atan2(dx, dz);
  for (let i = 0; i <= n; i++) { const x = ax + dx * i / n, z = az + dz * i / n; scene.add(mesh(postG, fm, x, H(x, z) + .65, z)); solids.push([x, z, .3]); }
  [.5, 1].forEach(y => { const r = mesh(new THREE.BoxGeometry(.1, .12, L), fm, ax + dx / 2, H(ax + dx / 2, az + dz / 2) + y, az + dz / 2); r.rotation.y = th; scene.add(r); });
}
fence(-6, 22, -6, 32); fence(6, 22, 6, 32); fence(-6, 32, 6, 32); fence(-6, 22, -2, 22); fence(2, 22, 6, 22);

// ---------- Dunia tambahan: langit berubah, kolam, kincir, rumput, bunga, asap ----------
const S0 = ['#4a5fa8', '#d98fa0', '#f0b68a', '#f0b68a'].map(c => new THREE.Color(c)), S1 = ['#070b1d', '#121a40', '#26305f', '#26305f'].map(c => new THREE.Color(c)), tc = new THREE.Color();
function paintSky(n) { const g = sx.createLinearGradient(0, 0, 0, 256); [0, .5, .8, 1].forEach((p, i) => g.addColorStop(p, '#' + tc.copy(S0[i]).lerp(S1[i], n).getHexString())); sx.fillStyle = g; sx.fillRect(0, 0, 2, 256); scene.background.needsUpdate = true; scene.fog.color.copy(S0[2]).lerp(S1[2], n); }
const star = []; for (let i = 0; i < 350; i++) { const a = rr(0, 6.28), e = rr(.1, 1.4); star.push(Math.cos(a) * Math.cos(e) * 220, Math.sin(e) * 220, Math.sin(a) * Math.cos(e) * 220); }
const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(star, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
stars.frustumCulled = false; scene.add(stars);

const pond = new THREE.CircleGeometry(7, 22); pond.rotateX(-Math.PI / 2);
const water = new THREE.Mesh(pond, M(0x3b8fb5, { transparent: true, opacity: .88, roughness: .25, metalness: .15 })); water.position.set(0, H(0, -34) + .2, -34); water.receiveShadow = true; scene.add(water);
solids.push([0, -34, 6.3]);
const sg = new THREE.DodecahedronGeometry(1, 0), sgm = M(0x8f8f95), padG = new THREE.CylinderGeometry(.6, .6, .05, 8), padM = M(0x4f9a4a);
for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, sc = rr(.5, .9), r = mesh(sg, sgm, Math.cos(a) * 7.2, H(0, -34) + sc * .3, -34 + Math.sin(a) * 7.2); r.scale.set(sc, sc * .7, sc); r.rotation.y = rr(0, 3); scene.add(r); }
for (let i = 0; i < 6; i++) { const a = rr(0, 6.28), d = rr(1, 5); scene.add(mesh(padG, padM, Math.cos(a) * d, H(0, -34) + .32, -34 + Math.sin(a) * d)); }

const WX = 34, WZ = -30, wm = new THREE.Group(), wood = M(0x5a3a22);
wm.add(mesh(new THREE.CylinderGeometry(1.6, 2.5, 7, 8), M(0xe8e0d0), 0, 3.5, 0));
wm.add(mesh(new THREE.ConeGeometry(2.1, 2.4, 8), M(0x9c3d2c), 0, 8.1, 0));
wm.add(mesh(new THREE.BoxGeometry(1, 1.8, .15), wood, 0, .9, 2.3));
const blades = new THREE.Group(); blades.position.set(0, 6.6, 2.1);
for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; arm.add(mesh(new THREE.BoxGeometry(.18, 6, .14), wood, 0, 3, 0)); arm.add(mesh(new THREE.BoxGeometry(.9, 3.6, .08), M(0xf2ead8), .5, 3.6, .06)); blades.add(arm); }
blades.add(mesh(new THREE.SphereGeometry(.4, 8, 6), wood)); wm.add(blades);
wm.position.set(WX, H(WX, WZ), WZ); wm.rotation.y = Math.atan2(-WX, -WZ); scene.add(wm); solids.push([WX, WZ, 2.8]);
path(WX + Math.sin(wm.rotation.y) * 3.4, WZ + Math.cos(wm.rotation.y) * 3.4);

const gm = new THREE.InstancedMesh(new THREE.ConeGeometry(.14, .7, 4), M(0xffffff), 1800), fl = new THREE.InstancedMesh(new THREE.SphereGeometry(.17, 5, 4), M(0xffffff, { emissive: 0x222222 }), 300), dm = new THREE.Object3D(), cc = new THREE.Color();
const GC = [0x6aa84a, 0x86bf52, 0x4f8f3c], FC = [0xff7aa8, 0xffffff, 0xffd24a, 0xb58cff, 0xff8a5a];
let gi = 0, fi = 0;
for (let n = 0; n < 6000 && (gi < 1800 || fi < 300); n++) {
  const x = rr(-85, 85), z = rr(-85, 85); if (nearPath(x, z) || solids.some(o => Math.hypot(o[0] - x, o[1] - z) < o[2])) continue;
  dm.position.set(x, H(x, z) + (n % 6 ? .3 : .2), z); dm.rotation.set(rr(-.2, .2), rr(0, 6), rr(-.2, .2)); dm.scale.setScalar(rr(.7, 1.5)); dm.updateMatrix();
  if (n % 6 && gi < 1800) { gm.setMatrixAt(gi, dm.matrix); gm.setColorAt(gi++, cc.setHex(GC[n % 3])); } else if (n % 6 === 0 && fi < 300) { fl.setMatrixAt(fi, dm.matrix); fl.setColorAt(fi++, cc.setHex(FC[n % 5])); }
}
gm.count = gi; fl.count = fi; scene.add(gm, fl);
const puffs = []; chim.forEach(c => { for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(.4, 0), new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true })); p.userData = { c, k }; scene.add(p); puffs.push(p); } });

const pg = [new THREE.ConeGeometry(2, 3, 7), new THREE.ConeGeometry(1.6, 2.6, 7), new THREE.ConeGeometry(1.1, 2.2, 7)];
const trunkG = new THREE.CylinderGeometry(.25, .35, 2, 6), pm = [M(0x2f6b3a), M(0x3d8046)], tm = M(0x6b4a2b);
function pine(x, z) {
  const g = new THREE.Group(), sc = rr(.8, 1.5);
  g.add(mesh(trunkG, tm, 0, 1, 0)); [2.6, 4, 5.2].forEach((y, i) => g.add(mesh(pg[i], pm[i % 2], 0, y, 0)));
  g.position.set(x, H(x, z), z); g.scale.setScalar(sc); g.rotation.y = rr(0, 6); scene.add(g); solids.push([x, z, .5 * sc]);
}
const palmT = new THREE.CylinderGeometry(.18, .3, 5, 6), leafG = new THREE.SphereGeometry(1, 5, 3), lm = M(0x4fa34a), nutG = new THREE.SphereGeometry(.28, 6, 5);
function palm(x, z) {
  const g = new THREE.Group(), t = mesh(palmT, tm, 0, 2.5, 0); t.rotation.z = .1; g.add(t);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, l = mesh(leafG, lm, -.25 + Math.cos(a) * 1.4, 4.9 - .15, Math.sin(a) * 1.4); l.scale.set(1.7, .12, .45); l.rotation.y = -a; l.rotation.z = Math.cos(a) * .0; g.add(l); }
  [0, 2, 4].forEach(i => g.add(mesh(nutG, tm, -.25 + Math.cos(i) * .3, 4.7, Math.sin(i) * .3)));
  g.position.set(x, H(x, z), z); g.rotation.y = rr(0, 6); scene.add(g); solids.push([x, z, .45]);
}
const rockG = new THREE.DodecahedronGeometry(1, 0), rockM = M(0x8f8f95);
for (let i = 0, n = 0; i < 400 && n < 130; i++) {
  const x = rr(-95, 95), z = rr(-95, 95);
  if (!free(x, z, 2.5)) continue; n++;
  if (n % 5 === 0) { const sc = rr(.5, 1.6), r = mesh(rockG, rockM, x, H(x, z) + sc * .3, z); r.scale.set(sc, sc * rr(.5, .8), sc); r.rotation.set(rr(0, 3), rr(0, 3), 0); scene.add(r); if (sc > .8) solids.push([x, z, sc * .9]); }
  else if (n % 6 === 0) palm(x, z); else pine(x, z);
}

// ---------- Awan, kunang-kunang ----------
const clouds = [], cloudM = M(0xffffff, { emissive: 0xffc8b0, emissiveIntensity: .4, fog: false });
for (let i = 0; i < 9; i++) {
  const c = new THREE.Group();
  for (let j = 0; j < 4; j++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), cloudM); b.position.set(j * 3 - 4, rr(-.5, .5), rr(-1, 1)); b.scale.set(rr(2, 3.5), rr(1.2, 2), rr(1.5, 2.5)); c.add(b); }
  c.position.set(rr(-130, 130), rr(40, 55), rr(-130, 40)); scene.add(c); clouds.push(c);
}
const fp = []; for (let i = 0; i < 140; i++) fp.push(rr(-60, 60), rr(.6, 5), rr(-60, 60));
const flies = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)), new THREE.PointsMaterial({ color: 0xfff0a0, size: .35, transparent: true, opacity: .9 }));
scene.add(flies);

// ---------- Karakter ----------
const P = new THREE.Group(), V = new THREE.Group(); P.add(V);
const skin = M(0xf1c27d), shirt = M(0xd9503f), pants = M(0x36548c), brown = M(0x5a3a22), dark = M(0x222222);
V.add(mesh(new THREE.CylinderGeometry(.36, .44, .95, 8), shirt, 0, 1.1, 0));
V.add(mesh(new THREE.SphereGeometry(.36, 12, 10), skin, 0, 1.85, 0));
V.add(mesh(new THREE.CylinderGeometry(.55, .55, .06, 12), brown, 0, 2.08, 0));
V.add(mesh(new THREE.ConeGeometry(.4, .5, 8), brown, 0, 2.32, 0));
[-.12, .12].forEach(x => V.add(mesh(new THREE.SphereGeometry(.05, 6, 6), dark, x, 1.88, .33)));
V.add(mesh(new THREE.BoxGeometry(.5, .6, .25), brown, 0, 1.15, -.42));
const limb = (x, y, r, len, mat) => { const g = new THREE.Group(); g.position.set(x, y, 0); g.add(mesh(new THREE.CylinderGeometry(r, r * .9, len, 6), mat, 0, -len / 2, 0)); V.add(g); return g; };
const aL = limb(-.55, 1.5, .11, .8, shirt), aR = limb(.55, 1.5, .11, .8, shirt), lL = limb(-.2, .65, .14, .65, pants), lR = limb(.2, .65, .14, .65, pants);
scene.add(P);

// ---------- Pak Darto (penduduk desa) ----------
const NX = -5, NZ = 4, npc = P.clone();
npc.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); const h = o.material.color.getHex(); if (h === 0xd9503f) o.material.color.setHex(0x4f8f6d); else if (h === 0x5a3a22) o.material.color.setHex(0xe3d08a); else if (h === 0x36548c) o.material.color.setHex(0x6b4a2b); } });
npc.position.set(NX, H(NX, NZ), NZ); scene.add(npc); solids.push([NX, NZ, .7]);

// ---------- Penduduk lain yang sedang beraktivitas ----------
function villager(x, z, shirt, hat, pants, sc) {
  const g = P.clone(), V = g.children[0], n = V.children.length;
  g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); const h = o.material.color.getHex(); if (h === 0xd9503f) o.material.color.setHex(shirt); else if (h === 0x5a3a22) o.material.color.setHex(hat); else if (h === 0x36548c) o.material.color.setHex(pants); } });
  g.position.set(x, H(x, z), z); g.scale.setScalar(sc || 1); scene.add(g);
  return { g, V, aL: V.children[n - 4], aR: V.children[n - 3], lL: V.children[n - 2], lR: V.children[n - 1] };
}
// Pak Heru memancing di tepi kolam
const fish = villager(2, -25.9, 0x3d6fa8, 0xd8c27a, 0x5a4a38), fd = new THREE.Vector3(-2, 0, -8.1).normalize();
fish.g.rotation.y = Math.atan2(fd.x, fd.z); solids.push([2, -25.9, .7]);
const rod = mesh(new THREE.CylinderGeometry(.03, .05, 3, 5), wood, .35, 2.2, 1.86); rod.rotation.x = 1; fish.g.add(rod);
const bob = mesh(new THREE.SphereGeometry(.12, 6, 5), M(0xff4a3a), 0, 0, 5.8), bobY = water.position.y - fish.g.position.y + .08; fish.g.add(bob);
fish.g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.35, 3, 3.1), new THREE.Vector3(0, bobY, 5.8)]), new THREE.LineBasicMaterial({ color: 0xffffff })));
fish.aL.rotation.x = -1.2;
// Pak Tani mencangkul petak tanah
const farm = villager(0, -4.3, 0xc9a23c, 0xe3d08a, 0x4a4a52); farm.g.rotation.y = Math.PI; solids.push([0, -4.3, .7]);
farm.aR.add(mesh(new THREE.CylinderGeometry(.04, .04, 1.2, 5), wood, 0, -1.4, 0)); farm.aR.add(mesh(new THREE.BoxGeometry(.5, .08, .26), M(0x8f8f95), 0, -2, .1));
scene.add(mesh(new THREE.BoxGeometry(3.6, .12, 2), M(0x5b3d24), 0, H(0, -6.3) + .06, -6.3));
// Bu Ratmi menyapu halaman rumah
const sry = Math.atan2(20, -12), swx = -20 + Math.sin(sry) * 6.4 + Math.cos(sry) * 2.4, swz = 12 + Math.cos(sry) * 6.4 - Math.sin(sry) * 2.4;
const sweep = villager(swx, swz, 0xb04a7a, 0xe8c9a0, 0x4a3a5a); sweep.g.rotation.y = sry + Math.PI; solids.push([swx, swz, .7]);
sweep.aR.add(mesh(new THREE.CylinderGeometry(.04, .04, 1.6, 5), wood, 0, -1.5, 0));
const brush = mesh(new THREE.ConeGeometry(.28, .45, 6), M(0xc9a85a), 0, -2.45, 0); brush.rotation.x = Math.PI; sweep.aR.add(brush);
// Si Kecil bolak-balik di jalan setapak
const kid = villager(3, 2.7, 0x3aa6b9, 0xf2c14e, 0x7a3b3b, .72), KA = [3, 2.7], KB = [13, 12.5]; let kt = 0, kdir = 1;
// Domba di kandang
const sheep = [];
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group(), wl = M(0xf4f1e8), dk = M(0x3a3330), b = mesh(new THREE.IcosahedronGeometry(.75, 1), wl, 0, .85, 0); b.scale.set(1.1, .85, .8); g.add(b);
  g.add(mesh(new THREE.SphereGeometry(.28, 6, 5), dk, .82, 1, 0));
  [[.4, .3], [.4, -.3], [-.4, .3], [-.4, -.3]].forEach(l => g.add(mesh(new THREE.CylinderGeometry(.07, .07, .5, 5), dk, l[0], .25, l[1])));
  const x = rr(-4, 4), z = rr(24, 30); g.position.set(x, H(x, z), z); scene.add(g); sheep.push({ g, tx: x, tz: z, wait: rr(0, 3) });
}
function crew(dt) {
  const t = time, s = Math.sin(t * 3);
  bob.position.y = bobY + Math.sin(t * 3) * .04; fish.aR.rotation.x = -1.2 - .3 * Math.pow(Math.max(0, Math.sin(t * .6)), 6); fish.V.rotation.x = Math.sin(t * .8) * .03;
  farm.aL.rotation.x = farm.aR.rotation.x = -1 - .9 * s; farm.V.rotation.x = .25 + .12 * s;
  sweep.aR.rotation.x = -.5 + Math.sin(t * 4) * .4; sweep.aL.rotation.x = -.3 - Math.sin(t * 4) * .2; sweep.V.rotation.x = .15;
  const L = Math.hypot(KB[0] - KA[0], KB[1] - KA[1]); kt += kdir * dt * 1.7 / L; if (kt > 1) { kt = 1; kdir = -1; } if (kt < 0) { kt = 0; kdir = 1; }
  const kx = KA[0] + (KB[0] - KA[0]) * kt, kz = KA[1] + (KB[1] - KA[1]) * kt, w = Math.sin(t * 9) * .8;
  kid.g.position.set(kx, H(kx, kz) + Math.abs(Math.sin(t * 9)) * .06, kz); kid.g.rotation.y = Math.atan2((KB[0] - KA[0]) * kdir, (KB[1] - KA[1]) * kdir);
  kid.aL.rotation.x = w; kid.aR.rotation.x = -w; kid.lL.rotation.x = -w; kid.lR.rotation.x = w;
  sheep.forEach((o, i) => {
    const p = o.g.position;
    if (o.wait > 0) { o.wait -= dt; return; }
    const dx = o.tx - p.x, dz = o.tz - p.z, d = Math.hypot(dx, dz);
    if (d < .2) { o.tx = rr(-4.5, 4.5); o.tz = rr(24, 30.5); o.wait = rr(1, 4); return; }
    p.x += dx / d * .9 * dt; p.z += dz / d * .9 * dt; p.y = H(p.x, p.z) + Math.abs(Math.sin(t * 8 + i)) * .05;
    o.g.rotation.y = Math.atan2(-dz, dx);
  });
}
let t0 = 0, lastTxt = '', skyT = 0, ac;
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const beep = (f, d, t, v) => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.type = t || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(v || .12, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + d); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d); } catch (e) {} };
const DIRS = ['depan', 'depan kanan', 'kanan', 'belakang kanan', 'belakang', 'belakang kiri', 'kiri', 'depan kiri'], wpos = pond.attributes.position;
// ---------- Siklus waktu: siang, sore, malam, pagi (1 putaran = 200 detik) ----------
const K = [
  { s: ['#3d7fd1', '#79b4ec', '#cfe6f5', '#cfe6f5'], l: 0xfff1d0, si: 1.35, hi: .95, ex: 1.05, st: 0, w: .2, e: 60, d: 0xfff4d0, c: 0xffffff, f: .1 },
  { s: ['#4a5fa8', '#d98fa0', '#f0b68a', '#f0b68a'], l: 0xffb878, si: 1.25, hi: .75, ex: 1.1, st: 0, w: .9, e: 14, d: 0xffd090, c: 0xffd6c4, f: .5 },
  { s: ['#01030a', '#050918', '#0a1029', '#0a1029'], l: 0x6f84e0, si: .1, hi: .1, ex: .85, st: 1, w: 3, e: 48, d: 0xdfe6ff, c: 0x3a4468, f: 1 },
  { s: ['#5a6fa8', '#e8a99a', '#f4cfa0', '#f4cfa0'], l: 0xffc890, si: .9, hi: .55, ex: 1, st: .2, w: 1, e: 10, d: 0xffd9a0, c: 0xffe0d0, f: .4 }
];
K.splice(3, 0, Object.assign({}, K[2])); // malam dibuat lebih lama
const lamp = new THREE.PointLight(0xffc880, 0, 22); lamp.position.set(0, 2.4, .5); P.add(lamp);
K.forEach(k => { k.s = k.s.map(c => new THREE.Color(c)); ['l', 'd', 'c'].forEach(q => k[q] = new THREE.Color(k[q])); });
const cur = { s: [0, 1, 2, 3].map(() => new THREE.Color()), l: new THREE.Color(), d: new THREE.Color(), c: new THREE.Color() }, PH = ['Siang', 'Sore', 'Malam', 'Malam', 'Pagi'], AZ = Math.atan2(28, 55);
let ph = 0;
function cycle() {
  ph = (time / 200) % 1; const N = K.length, i = Math.floor(ph * N), f = ph * N - i, u = f * f * (3 - 2 * f), a = K[i], b = K[(i + 1) % N], m = (x, y) => x + (y - x) * u;
  ['l', 'd', 'c'].forEach(q => cur[q].copy(a[q]).lerp(b[q], u)); cur.s.forEach((c, j) => c.copy(a.s[j]).lerp(b.s[j], u));
  const night = m(a.st, b.st), e = m(a.e, b.e) * Math.PI / 180;
  SUNDIR.set(Math.cos(AZ) * Math.cos(e), Math.sin(e), Math.sin(AZ) * Math.cos(e)).multiplyScalar(66);
  sun.color.copy(cur.l); sun.intensity = m(a.si, b.si); hemi.intensity = m(a.hi, b.hi); renderer.toneMappingExposure = m(a.ex, b.ex);
  disc.material.color.copy(cur.d); stars.material.opacity = night; lamp.intensity = 2.4 * night; stars.position.copy(cam.position);
  cloudM.color.copy(cur.c); cloudM.emissive.copy(cur.c); flies.material.opacity = .2 + .8 * m(a.f, b.f);
  wins.forEach(w => w.emissiveIntensity = m(a.w, b.w));
  if (time - skyT > .3) { skyT = time; const g = sx.createLinearGradient(0, 0, 0, 256); [0, .5, .8, 1].forEach((p, j) => g.addColorStop(p, '#' + cur.s[j].getHexString())); sx.fillStyle = g; sx.fillRect(0, 0, 2, 256); scene.background.needsUpdate = true; scene.fog.color.copy(cur.s[2]); }
}
function extras(dt) {
  crew(dt);
  cycle();
  for (let i = 0; i < wpos.count; i++) wpos.setY(i, .07 * Math.sin(time * 2 + wpos.getX(i) * 1.3 + wpos.getZ(i) * 1.1)); wpos.needsUpdate = true;
  blades.rotation.z += dt * .8;
  puffs.forEach(p => { const t = (time * .3 + p.userData.k * .25) % 1, c = p.userData.c; p.position.set(c[0] + t * 1.5, c[1] + t * 4, c[2]); p.scale.setScalar(.5 + t * 1.8); p.material.opacity = .55 * (1 - t); });
  npc.rotation.y = Math.atan2(px - NX, pz - NZ); npc.position.y = H(NX, NZ) + Math.sin(time * 1.5) * .03;
  let txt = '';
  if (running && !quizOn && stage < 2 && Math.hypot(px - NX, pz - NZ) < 8) {
    if (stage) txt = 'Kristalnya sudah menyala, Nak. Cepat ke tengah desa.';
    else {
      let best = 1e9, bx = 0, bz = 0; coins.forEach(c => { if (c.g.visible) { const d = Math.hypot(c.g.position.x - px, c.g.position.z - pz); if (d < best) { best = d; bx = c.g.position.x - px; bz = c.g.position.z - pz; } } });
      const r = bx * Math.cos(yaw) - bz * Math.sin(yaw), f = -bx * Math.sin(yaw) - bz * Math.cos(yaw);
      txt = 'Koin terdekat sekitar ' + Math.round(best) + ' langkah dari sini, arahnya ' + DIRS[Math.round(((Math.atan2(r, f) + 6.283) % 6.283) / .7854) % 8] + ' dari hadapanmu.';
    }
  }
  $('npc').style.display = txt ? 'block' : 'none'; if (txt && txt !== lastTxt) { $('nt').textContent = txt; lastTxt = txt; }
  if (running) $('tm').textContent = fmt(time - t0) + ' · ' + PH[Math.round(ph * K.length) % K.length];
}

// ---------- Koin & Kristal ----------
const coinG = new THREE.CylinderGeometry(.55, .55, .14, 16), coinM = M(0xffc83a, { emissive: 0xb87a00, emissiveIntensity: .8, metalness: .6, roughness: .3 });
const beamG = new THREE.CylinderGeometry(.1, .1, 8, 6), beamM = new THREE.MeshBasicMaterial({ color: 0xffd966, transparent: true, opacity: .3 });
const coins = [];
for (let i = 0; i < 12; i++) {
  let x = 0, z = 27; if (i) do { const a = rr(0, 6.28), d = rr(10, 80); x = Math.cos(a) * d; z = Math.sin(a) * d; } while (!free(x, z, 1.5));
  const g = new THREE.Group(), c = mesh(coinG, coinM); c.rotation.x = Math.PI / 2; g.add(c);
  const b = new THREE.Mesh(beamG, beamM); b.position.y = 3; g.add(b);
  g.position.set(x, H(x, z) + 1.3, z); scene.add(g); coins.push({ g, y0: g.position.y });
}
const crystalM = M(0x7a7a88, { emissive: 0x000000 });
const crystal = mesh(new THREE.IcosahedronGeometry(1.1, 0), crystalM, 0, 2.2, 0); crystal.scale.y = 1.6; scene.add(crystal);
scene.add(mesh(new THREE.CylinderGeometry(1.8, 2.2, .6, 8), stoneM, 0, .3, 0));
const cLight = new THREE.PointLight(0x40e0ff, 0, 30); cLight.position.set(0, 3, 0); scene.add(cLight);

// ---------- Input ----------
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); });
addEventListener('keyup', e => keys[e.code] = false);
let yaw = 0, pitch = .42, dp = null, lx = 0, ly = 0;
cvs.addEventListener('pointerdown', e => { if (dp === null) { dp = e.pointerId; lx = e.clientX; ly = e.clientY; cvs.setPointerCapture(e.pointerId); } });
cvs.addEventListener('pointermove', e => { if (e.pointerId !== dp) return; yaw -= (e.clientX - lx) * .006; pitch = Math.min(1.2, Math.max(.1, pitch + (e.clientY - ly) * .005)); lx = e.clientX; ly = e.clientY; });
const dpUp = e => { if (e.pointerId === dp) dp = null; };
cvs.addEventListener('pointerup', dpUp); cvs.addEventListener('pointercancel', dpUp);
// Joystick & tombol lompat (layar sentuh)
let joyX = 0, joyY = 0; const joy = $('joy'), knob = $('knob');
const jm = e => { const r = joy.getBoundingClientRect(), R = r.width / 2; let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } joyX = x; joyY = y; knob.style.transform = `translate(${x * R * .6}px,${y * R * .6}px)`; };
const jr = () => { joyX = joyY = 0; knob.style.transform = ''; };
joy.addEventListener('pointerdown', e => { joy.setPointerCapture(e.pointerId); jm(e); });
joy.addEventListener('pointermove', e => { if (joy.hasPointerCapture(e.pointerId)) jm(e); });
joy.addEventListener('pointerup', jr); joy.addEventListener('pointercancel', jr);
const jb = $('jump'), jset = v => () => keys.Space = v;
jb.addEventListener('pointerdown', jset(true)); jb.addEventListener('pointerup', jset(false)); jb.addEventListener('pointercancel', jset(false));

let tt; const toast = m => { const e = $('toast'); e.textContent = m; e.style.opacity = 1; clearTimeout(tt); tt = setTimeout(() => e.style.opacity = 0, 3500); };

// ---------- Loop ----------
let running = false, px = 0, pz = 9, py = H(0, 9), vx = 0, vz = 0, vy = 0, face = Math.PI, walk = 0, score = 0, stage = 0, time = 0;
const clock = new THREE.Clock();
$('go').onclick = () => { $('start').classList.add('hidden'); running = true; t0 = time; toast('Titik kuning di peta adalah koin. Ikuti juga pilar cahaya kuning.'); };

// ---------- Peta mini (atas = arah kamera) ----------
const mctx = $('map').getContext('2d'), MS = 170, MR = 60, houses = [[-15, -14], [17, -12], [-20, 12], [19, 17]];
function drawMap() {
  const c = mctx, h = MS / 2, k = h / MR, sy = Math.sin(yaw), cy = Math.cos(yaw);
  const pt = (x, z) => { const dx = x - px, dz = z - pz; return [dx * cy - dz * sy, dx * sy + dz * cy]; }; // [kanan, mundur]
  c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, MS, MS);
  c.save(); c.beginPath(); c.arc(h, h, h - 3, 0, 6.283); c.clip(); c.translate(h, h);
  c.fillStyle = '#2f5b3a55'; c.fillRect(-h, -h, MS, MS);
  c.fillStyle = '#d9c29a'; houses.forEach(o => { const [x, y] = pt(o[0], o[1]); c.fillRect(x * k - 4, y * k - 4, 8, 8); });
  const [kx, ky] = pt(0, 0); c.fillStyle = stage ? '#55f0ff' : '#8a8a99';
  c.beginPath(); c.moveTo(kx * k, ky * k - 6); c.lineTo(kx * k + 5, ky * k); c.lineTo(kx * k, ky * k + 6); c.lineTo(kx * k - 5, ky * k); c.fill();
  coins.forEach(o => {
    if (!o.g.visible) return;
    let [x, y] = pt(o.g.position.x, o.g.position.z); x *= k; y *= k;
    const d = Math.hypot(x, y), far = d > h - 10; if (far) { x *= (h - 10) / d; y *= (h - 10) / d; }
    c.fillStyle = '#ffd23a'; c.strokeStyle = '#7a4a00'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(x, y, far ? 3 : 4.5, 0, 6.283); c.fill(); c.stroke();
  });
  c.rotate(Math.PI - (face - yaw)); c.fillStyle = '#fff'; c.strokeStyle = '#d9503f'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 7); c.lineTo(0, 3); c.lineTo(-6, 7); c.closePath(); c.fill(); c.stroke();
  c.restore();
}

// ---------- Kuis: jawaban benar = indeks 0 (urutan diacak saat ditampilkan) ----------
const QZ = [
  ['Berapa hasil 7 x 8?', ['56', '54', '58']],
  ['Planet yang paling dekat dengan Matahari?', ['Merkurius', 'Venus', 'Mars']],
  ['Tumbuhan membuat makanan sendiri lewat proses?', ['Fotosintesis', 'Respirasi', 'Evaporasi']],
  ['Padi yang dipanen dan digiling menjadi?', ['Beras', 'Jagung', 'Gula']],
  ['Alat musik bambu tradisional dari Jawa Barat?', ['Angklung', 'Sasando', 'Tifa']],
  ['Campuran warna biru dan kuning menghasilkan?', ['Hijau', 'Ungu', 'Oranye']],
  ['Bahasa Inggris dari "pohon" adalah?', ['Tree', 'Rock', 'House']],
  ['Air membeku pada suhu berapa?', ['0 derajat Celsius', '50 derajat Celsius', '100 derajat Celsius']],
  ['Berapa hasil 15 + 27?', ['42', '41', '43']],
  ['Lambang sila pertama Pancasila?', ['Bintang', 'Rantai', 'Pohon beringin']],
  ['Bahan utama pembuatan tempe?', ['Kedelai', 'Singkong', 'Kentang']],
  ['Hewan berikut yang bertelur dan bisa terbang?', ['Burung', 'Sapi', 'Kambing']]
];
let quizOn = false, bag = [];
function ask(c) {
  if (!bag.length) bag = QZ.map((_, i) => i).sort(() => rnd() - .5);
  const [q, o] = QZ[bag.pop()], box = $('opts'); quizOn = true; vx = vz = 0; keys.Space = false; jr();
  $('qq').textContent = q; box.innerHTML = '';
  o.map((t, i) => [t, i]).sort(() => rnd() - .5).forEach(([t, i]) => {
    const b = document.createElement('button'); b.className = 'opt'; b.textContent = t;
    b.onclick = () => { $('quiz').classList.add('hidden'); quizOn = false; if (i === 0) { c.ok = true; beep(660, .12); setTimeout(() => beep(990, .22), 110); } else { c.cd = time + 4; beep(150, .35, 'sawtooth'); toast('Jawaban salah. Koin menghilang sebentar, coba lagi nanti.'); } };
    box.appendChild(b);
  });
  $('quiz').classList.remove('hidden');
}

function update(dt) {
  if (quizOn) return;
  const fx = Math.max(-1, Math.min(1, (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joyX));
  const fz = Math.max(-1, Math.min(1, (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joyY));
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  let mx = -sy * fz + cy * fx, mz = -cy * fz - sy * fx; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  const sp = keys.ShiftLeft || keys.ShiftRight ? 11 : 7, k = 1 - Math.exp(-10 * dt);
  vx += (mx * sp - vx) * k; vz += (mz * sp - vz) * k;
  px += vx * dt; pz += vz * dt;
  for (const o of solids) { const dx = px - o[0], dz = pz - o[1], d = Math.hypot(dx, dz), m = o[2] + .45; if (d < m && d > 0) { px = o[0] + dx / d * m; pz = o[1] + dz / d * m; } }
  const rd = Math.hypot(px, pz); if (rd > 100) { px *= 100 / rd; pz *= 100 / rd; }
  const gy = H(px, pz), ground = py <= gy + .05 && vy <= 0;
  if (ground && keys.Space) vy = 10;
  vy -= 28 * dt; py += vy * dt; if (py <= gy) { py = gy; vy = 0; }
  const spd = Math.hypot(vx, vz);
  if (spd > .4) { let d = Math.atan2(vx, vz) - face; d = Math.atan2(Math.sin(d), Math.cos(d)); face += d * (1 - Math.exp(-12 * dt)); }
  walk += dt * spd * 1.6;
  const sw = Math.sin(walk) * Math.min(1, spd / 6) * .9;
  if (ground) { aL.rotation.x = sw; aR.rotation.x = -sw; lL.rotation.x = -sw; lR.rotation.x = sw; V.position.y = Math.abs(Math.sin(walk)) * .08 * Math.min(1, spd / 6); }
  else { aL.rotation.x = aR.rotation.x = -2.4; lL.rotation.x = .4; lR.rotation.x = -.4; V.position.y = 0; }
  P.position.set(px, py, pz); P.rotation.y = face;

  const cd = 9, cx = px + Math.sin(yaw) * Math.cos(pitch) * cd, cz = pz + Math.cos(yaw) * Math.cos(pitch) * cd, cyy = Math.max(py + 1.6 + Math.sin(pitch) * cd, H(cx, cz) + 1);
  cam.position.lerp(new THREE.Vector3(cx, cyy, cz), 1 - Math.exp(-8 * dt)); cam.lookAt(px, py + 1.6, pz);
  sun.position.set(px + SUNDIR.x, py + SUNDIR.y, pz + SUNDIR.z); sun.target.position.set(px, py, pz);

  coins.forEach((c, i) => {
    if (!c.g.visible) return;
    c.g.rotation.y += dt * 2.2; c.g.position.y = c.y0 + Math.sin(time * 2 + i) * .2;
    if (!c.ok && time > (c.cd || 0) && Math.hypot(c.g.position.x - px, c.g.position.z - pz) < 1.4 && Math.abs(c.g.position.y - py - 1) < 2.5) ask(c);
    if (c.ok) {
      c.g.visible = false; score++; $('sc').textContent = score;
      if (score === 4) toast('Terdengar bisikan dari balik pepohonan...');
      else if (score === 8) toast('Kabut menebal. Kristal di tengah desa bergetar.');
      else if (score < 12) toast('Koin Kuno ditemukan');
    }
  });
  drawMap();
  if (score === 12 && stage === 0) {
    stage = 1; crystalM.color.set(0x40e0ff); crystalM.emissive.set(0x1aa0c0); crystalM.emissiveIntensity = 1.3; cLight.intensity = 2.5;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 40, 8), new THREE.MeshBasicMaterial({ color: 0x66f0ff, transparent: true, opacity: .35 })); b.position.set(0, 20, 0); scene.add(b);
    $('mt').textContent = 'Semua koin terkumpul. Sentuh kristal biru di tengah desa.'; toast('Kristal di tengah desa bersinar!');
  }
  if (stage === 1 && Math.hypot(px, pz) < 2.6) { stage = 2; running = false; const sc2 = time - t0; let bst = sc2; try { bst = Math.min(sc2, +localStorage.getItem('desaBest') || sc2); localStorage.setItem('desaBest', bst); } catch (e) {} $('res').textContent = 'Waktumu ' + fmt(sc2) + '. Rekor terbaikmu ' + fmt(bst) + '.'; [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .5), i * 140)); $('end').classList.remove('hidden'); }
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .05); time += dt;
  if (running) update(dt);
  else { const a = time * .1; cam.position.set(Math.sin(a) * 22, 9, 9 + Math.cos(a) * 22); cam.lookAt(0, 3, 0); }
  extras(dt);
  crystal.rotation.y += dt * (stage ? 1.5 : .3);
  clouds.forEach(c => { c.position.x += dt * .8; if (c.position.x > 140) c.position.x = -140; });
  flies.position.y = Math.sin(time) * .4; flies.rotation.y += dt * .02;
  disc.position.copy(cam.position).addScaledVector(SUNDIR.clone().normalize(), 250);
  renderer.render(scene, cam);
}
frame();
})();