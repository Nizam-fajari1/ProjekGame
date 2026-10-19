// ============================================================
//  ring.js — Fitur Ring Adu Jotos (PvP lokal & mabar)
//  Butuh: game.js (akses global lewat window.Game)
// ============================================================
(() => {
const $ = id => document.getElementById(id);

// ---------- Ambil referensi dari game.js ----------
if (!window.Game) {
  console.warn('ring.js: window.Game belum siap. Pastikan game.js dimuat lebih dulu.');
  return;
}
const G = window.Game;

// ============================================================
//  KONFIGURASI RING
// ============================================================
const RING_X = 24;      // posisi ring di dunia
const RING_Z = 8;
const RING_R = 6;       // radius ring
const RING_H = 0.5;     // tinggi lantai ring

// ============================================================
//  BANGUN RING DI DUNIA
// ============================================================
const ringGroup = new THREE.Group();
ringGroup.position.set(RING_X, G.H(RING_X, RING_Z), RING_Z);
G.scene.add(ringGroup);

// --- Lantai ring (matras) ---
const floorMat = new THREE.MeshStandardMaterial({
  color: 0xc94a3a,
  flatShading: true,
  roughness: .85
});
const ringFloor = new THREE.Mesh(
  new THREE.CylinderGeometry(RING_R, RING_R, RING_H, 32),
  floorMat
);
ringFloor.position.y = RING_H / 2;
ringFloor.receiveShadow = true;
ringGroup.add(ringFloor);

// --- Garis putih tengah ---
const midLine = new THREE.Mesh(
  new THREE.BoxGeometry(RING_R * 2 - 1, .05, .3),
  new THREE.MeshStandardMaterial({ color: 0xffffff })
);
midLine.position.y = RING_H + .03;
ringGroup.add(midLine);

// --- Tali ring (4 tiang + 3 tingkat tali) ---
const postMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, flatShading: true });
const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe8d8b8, flatShading: true });
const postGeo = new THREE.CylinderGeometry(.15, .15, 2.4, 8);
const ropeGeo = new THREE.CylinderGeometry(.04, .04, 1, 6);

for (let i = 0; i < 4; i++) {
  const a = i * Math.PI / 2 + Math.PI / 4;
  const x = Math.cos(a) * RING_R;
  const z = Math.sin(a) * RING_R;

  // Tiang
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.set(x, 1.2, z);
  post.castShadow = true;
  ringGroup.add(post);

  // Bola di atas tiang
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(.2, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0x886600, emissiveIntensity: .4 })
  );
  ball.position.set(x, 2.45, z);
  ringGroup.add(ball);
}

// Tali penghubung antar tiang (3 tingkat)
for (let lvl = 0; lvl < 3; lvl++) {
  const y = .6 + lvl * .7;
  for (let i = 0; i < 4; i++) {
    const a1 = i * Math.PI / 2 + Math.PI / 4;
    const a2 = (i + 1) * Math.PI / 2 + Math.PI / 4;
    const x1 = Math.cos(a1) * RING_R, z1 = Math.sin(a1) * RING_R;
    const x2 = Math.cos(a2) * RING_R, z2 = Math.sin(a2) * RING_R;
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    const len = Math.hypot(x2 - x1, z2 - z1);
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(.04, .04, len, 6),
      ropeMat
    );
    rope.position.set(mx, y, mz);
    rope.rotation.z = Math.PI / 2;
    rope.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    ringGroup.add(rope);
  }
}

// --- Papan tanda "RING" ---
const signCanvas = document.createElement('canvas');
signCanvas.width = 256; signCanvas.height = 128;
const scx = signCanvas.getContext('2d');
scx.fillStyle = '#3b2514';
scx.fillRect(0, 0, 256, 128);
scx.fillStyle = '#ffd24a';
scx.font = 'bold 70px Impact, sans-serif';
scx.textAlign = 'center';
scx.fillText('RING', 128, 90);
const signTex = new THREE.CanvasTexture(signCanvas);
const sign = new THREE.Mesh(
  new THREE.PlaneGeometry(3, 1.5),
  new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide })
);
sign.position.set(0, 3.5, -RING_R - .5);
ringGroup.add(sign);

// ============================================================
//  STATE PERTARUNGAN
// ============================================================
const battle = {
  active: false,       // sedang di dalam ring
  inCombat: false,     // musuh juga di ring → bertarung
  hpMe: 100,
  hpFoe: 100,
  maxHp: 100,
  lastPunch: 0,
  punchCooldown: 0.35,
  foeLastPunch: 0,
  ko: false
};

// Simpan HP musuh dari network (diupdate multiplayer.js)
battle.foeHpRemote = 100;

// ============================================================
//  UI: HP BAR, PROMPT, FLASH, BATTLE MSG
// ============================================================
function showHp(show) {
  $('hpwrap').style.display = show ? 'block' : 'none';
}

function updateHpUI() {
  $('hpMe').style.width = Math.max(0, battle.hpMe / battle.maxHp * 100) + '%';
  $('hpFoe').style.width = Math.max(0, battle.hpFoe / battle.maxHp * 100) + '%';
}

function showBattleMsg(txt, dur) {
  const el = $('battleMsg');
  el.textContent = txt;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), dur || 1500);
}

function hitFlash() {
  const el = $('hitflash');
  el.style.opacity = .6;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.style.opacity = 0, 80);
}

// ============================================================
//  SUARA (pakai AudioContext)
// ============================================================
let ac = null;
function beep(freq, dur, type, vol) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || .15, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  } catch (e) {}
}
function sfxPunch() { beep(180, .08, 'square', .2); }
function sfxHit()   { beep(90, .15, 'sawtooth', .25); }
function sfxKO()    { [400, 300, 200, 100].forEach((f, i) => setTimeout(() => beep(f, .3, 'square', .2), i * 150)); }

// ============================================================
//  DETEKSI PEMAIN DI DEKAT RING
// ============================================================
function isNearRing(px, pz) {
  const dx = px - RING_X;
  const dz = pz - RING_Z;
  return Math.hypot(dx, dz) < RING_R + 3;
}

function isInsideRing(px, pz) {
  const dx = px - RING_X;
  const dz = pz - RING_Z;
  return Math.hypot(dx, dz) < RING_R - .5;
}

// ============================================================
//  ANIMASI PUKULAN PEMAIN
// ============================================================
let punchAnim = 0;   // 0 = idle, >0 = sedang memukul
function triggerPunchAnim() {
  punchAnim = .3;
}

function animateArms(dt) {
  if (punchAnim > 0) {
    punchAnim -= dt;
    const t = Math.max(0, punchAnim) / .3;
    // Lengan kanan maju
    G.aR.rotation.x = -Math.PI * .8 * t;
    G.aL.rotation.x = -Math.PI * .2 * t;
  }
}

// ============================================================
//  LOGIKA PUKULAN
// ============================================================
function tryPunch() {
  if (!battle.inCombat) return;
  if (battle.ko) return;
  if (battle.lastPunch + battle.punchCooldown > G.time) return;

  battle.lastPunch = G.time;
  triggerPunchAnim();
  sfxPunch();

  // Cek apakah lawan dalam jangkauan (jarak < 2.5)
  if (!G.rp || !G.rp.g.visible) return;
  const dx = G.rp.g.position.x - G.px;
  const dz = G.rp.g.position.z - G.pz;
  const dist = Math.hypot(dx, dz);

  if (dist < 2.5) {
    // Kena! Kirim ke network
    battle.foeHpRemote -= 12;   // perkiraan optimis, server-authoritative nanti
    updateHpUI();
    hitFlash();
    sfxHit();

    // Kirim pukulan ke teman
    if (window.MP && window.MP.sendPunch) {
      window.MP.sendPunch();
    }

    if (battle.foeHpRemote <= 0) {
      endBattle('win');
    }
  }
}

// ============================================================
//  TERIMA PUKULAN DARI TEMAN (dipanggil multiplayer.js)
// ============================================================
function receivePunch() {
  if (!battle.inCombat) return;
  if (battle.ko) return;

  battle.hpMe -= 12;
  updateHpUI();
  hitFlash();
  sfxHit();

  // Efek goyang kamera
  if (G.cam) {
    G.cam.position.x += (Math.random() - .5) * .3;
    G.cam.position.y += (Math.random() - .5) * .3;
  }

  if (battle.hpMe <= 0) {
    endBattle('lose');
  }
}

// ============================================================
//  MULAI / AKHIR PERTARUNGAN
// ============================================================
function startBattle() {
  battle.inCombat = true;
  battle.hpMe = battle.maxHp;
  battle.hpFoe = battle.foeHpRemote || battle.maxHp;
  battle.ko = false;
  showHp(true);
  updateHpUI();
  showBattleMsg('FIGHT!', 1500);
  sfxKO();
}

function endBattle(result) {
  battle.inCombat = false;
  battle.ko = true;

  if (result === 'win') {
    showBattleMsg('KAMU MENANG! 🏆', 3000);
  } else {
    showBattleMsg('KAMU KALAH 💀', 3000);
  }
  sfxKO();

  setTimeout(() => {
    showHp(false);
    battle.hpMe = battle.maxHp;
    battle.foeHpRemote = battle.maxHp;
    updateHpUI();
  }, 3200);
}

// ============================================================
//  INPUT: TOMBOL E & P / KLIK
// ============================================================
addEventListener('keydown', e => {
  // E = masuk/keluar ring
  if (e.code === 'KeyE') {
    if (battle.active) {
      battle.active = false;
      showHp(false);
      $('ringPrompt').style.display = 'none';
      G.toast('Kamu keluar dari ring.');
    } else if (isNearRing(G.px, G.pz)) {
      battle.active = true;
      $('ringPrompt').style.display = 'none';
      G.toast('Kamu masuk ke ring. Tunggu lawan...');

      // Kalau teman mabar juga di ring, mulai bertarung
      if (G.rp && G.rp.g.visible && isInsideRing(G.rp.g.position.x, G.rp.g.position.z)) {
        startBattle();
      }
    }
  }

  // P = pukul
  if (e.code === 'KeyP') {
    tryPunch();
  }
});

// Klik kiri = pukul (kalau di dalam ring)
G.cvs.addEventListener('pointerdown', e => {
  if (e.button === 0 && battle.inCombat) {
    // Delay sedikit biar tidak bentrok dengan drag kamera
    setTimeout(tryPunch, 100);
  }
});

// Tombol sentuh "Pukul"
const punchBtn = $('punch');
if (punchBtn) {
  punchBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    tryPunch();
  });
}

// ============================================================
//  LOOP: cek kondisi setiap frame (dipanggil dari game.js)
// ============================================================
function update(dt) {
  // Animasi lengan pukul
  animateArms(dt);

  // Prompt masuk ring
  if (!battle.active && isNearRing(G.px, G.pz) && G.running) {
    $('ringPrompt').style.display = 'block';
  } else {
    $('ringPrompt').style.display = 'none';
  }

  // Kalau di dalam ring & teman juga di dalam → mulai battle
  if (battle.active && !battle.inCombat && !battle.ko &&
      G.rp && G.rp.g.visible &&
      isInsideRing(G.px, G.pz) &&
      isInsideRing(G.rp.g.position.x, G.rp.g.position.z)) {
    startBattle();
  }

  // Kalau pemain keluar ring saat battle → akhiri
  if (battle.inCombat && !isInsideRing(G.px, G.pz)) {
    battle.active = false;
    battle.inCombat = false;
    showHp(false);
    showBattleMsg('Keluar dari ring', 1200);
  }
}

// ============================================================
//  EKSPOR API ke multiplayer.js & game.js
// ============================================================
window.Ring = {
  battle,
  update,
  receivePunch,
  startBattle,
  endBattle,
  isNearRing,
  isInsideRing,
  RING_X, RING_Z, RING_R
};

console.log('ring.js loaded ✓');
})();