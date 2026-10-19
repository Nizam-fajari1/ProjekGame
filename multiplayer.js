// ============================================================
//  multiplayer.js — Mabar 2 pemain via PeerJS
//  Butuh: game.js (window.Game) & ring.js (window.Ring)
// ============================================================
(() => {
const $ = id => document.getElementById(id);

// ---------- Cek dependensi ----------
if (!window.Game) {
  console.warn('multiplayer.js: window.Game belum siap.');
  return;
}
const G = window.Game;
const R = window.Ring || null;

// ============================================================
//  STATE
// ============================================================
let conn = null;
let peer = null;
let isHost = false;
let myName = 'Pemain';
let sendT = 0;
let rpWalk = 0;

// Posisi teman (interpolasi)
const rpT = { x: 0, y: 0, z: 0, f: 0, w: 0, a: 0 };

// Offset waktu (untuk sinkron siklus siang/malam)
let tOff = 0;

// ============================================================
//  NAMETAG DI ATAS KEPALA TEMAN
// ============================================================
function nameTag(txt) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const x = cv.getContext('2d');
  x.font = '700 28px Trebuchet MS, sans-serif';
  x.textAlign = 'center';
  const w = x.measureText(txt).width + 26;
  x.fillStyle = '#000a';
  x.fillRect(128 - w / 2, 10, w, 44);
  x.fillStyle = '#fff';
  x.fillText(txt, 128, 42);

  if (G.rp.tag) G.rp.g.remove(G.rp.tag);
  G.rp.tag = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv),
      depthTest: false,
      fog: false
    })
  );
  G.rp.tag.scale.set(3, .75, 1);
  G.rp.tag.position.y = 3;
  G.rp.tag.renderOrder = 10;
  G.rp.g.add(G.rp.tag);
}

// ============================================================
//  HANDLE KONEKSI
// ============================================================
function setup(c) {
  conn = c;

  const hi = () => c.send({ t: 'hi', n: myName, T: G.time });
  c.open ? hi() : c.on('open', hi);

  c.on('data', d => {
    // --- Handshake ---
    if (d.t === 'hi') {
      nameTag(String(d.n).slice(0, 12));
      G.rp.g.visible = true;
      if (!isHost) tOff = d.T - G.time;
      G.toast(d.n + ' bergabung!');
      if (!$('start').classList.contains('hidden')) $('go').click();
    }

    // --- Update posisi teman ---
    else if (d.t === 's') {
      if (!G.rp.seen) {
        G.rp.seen = true;
        G.rp.g.position.set(d.x, d.y, d.z);
      }
      rpT.x = d.x; rpT.y = d.y; rpT.z = d.z;
      rpT.f = d.f; rpT.w = d.w; rpT.a = d.a;
    }

    // --- Teman ambil koin ---
    else if (d.t === 'c') {
      const k = G.coins[d.i];
      if (k) { k.ok = true; k.remote = true; }
    }

    // --- Teman sentuh kristal (selesai) ---
    else if (d.t === 'w' && G.stage < 2) {
      G.stage = 2;
      G.running = false;
      $('res').textContent = 'Temanmu menyentuh kristal. Kalian berhasil bersama!';
      $('end').classList.remove('hidden');
    }

    // --- Battle: teman memukul kita ---
    else if (d.t === 'punch') {
      if (R && R.receivePunch) R.receivePunch();
    }

    // --- Battle: sinkron HP ---
    else if (d.t === 'hp') {
      if (R && R.battle) {
        R.battle.foeHpRemote = d.hp;
        // Update UI HP musuh
        const foeBar = document.getElementById('hpFoe');
        if (foeBar) {
          foeBar.style.width = Math.max(0, d.hp / R.battle.maxHp * 100) + '%';
        }
      }
    }

    // --- Battle: KO ---
    else if (d.t === 'ko') {
      if (R && R.battle) {
        R.battle.inCombat = false;
        R.battle.ko = true;
        const msg = document.getElementById('battleMsg');
        if (msg) {
          msg.textContent = d.win ? 'KAMU KALAH 💀' : 'KAMU MENANG! 🏆';
          msg.classList.add('show');
          clearTimeout(msg._t);
          msg._t = setTimeout(() => msg.classList.remove('show'), 3000);
        }
      }
    }
  });

  c.on('close', () => {
    G.rp.g.visible = false;
    conn = null;
    G.toast('Temanmu keluar dari permainan.');
  });

  c.on('error', e => {
    console.warn('Koneksi error:', e);
    G.toast('Koneksi terputus.');
  });
}

// ============================================================
//  VALIDASI NAMA
// ============================================================
function ready() {
  myName = ($('nm').value || 'Pemain').trim().slice(0, 12);
  if (typeof Peer === 'undefined') {
    $('lob').textContent = 'PeerJS gagal dimuat. Cek koneksi internet.';
    return false;
  }
  return true;
}

// ============================================================
//  ERROR HANDLER PEERJS
// ============================================================
function perr(e) {
  console.warn('PeerJS:', e);
  if (e.type === 'unavailable-id') return 'Kode bentrok, klik Buat room sekali lagi.';
  if (e.type === 'peer-unavailable') return 'Room tidak ditemukan. Pastikan temanmu sudah klik Buat room dan kodenya benar.';
  if (e.type === 'webrtc') return 'Koneksi antar pemain gagal. Coba ganti jaringan salah satu pemain (misalnya Wi-Fi ke data seluler).';
  if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
    return 'Tidak bisa menghubungi server PeerJS (' + e.type + '). Cek internet, matikan VPN atau ad-blocker, atau ganti jaringan, lalu coba lagi.';
  }
  return 'Gagal: ' + e.type;
}

// ============================================================
//  TOMBOL: BUAT ROOM
// ============================================================
$('mk').onclick = () => {
  if (!ready()) return;
  isHost = true;
  if (peer) peer.destroy();

  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 4; i++) id += A[Math.floor(Math.random() * A.length)];

  $('lob').textContent = 'Menghubungi server PeerJS...';
  peer = new Peer('desa-' + id);

  const to = setTimeout(() => {
    $('lob').textContent = 'Server PeerJS tidak merespons setelah 10 detik. Matikan VPN atau ad-blocker, atau ganti jaringan, lalu klik Buat room lagi.';
  }, 10000);

  peer.on('open', () => {
    clearTimeout(to);
    $('lob').textContent = 'Kode room: ' + id + '. Kirim ke temanmu, game mulai otomatis begitu dia masuk.';
  });

  peer.on('connection', setup);
  peer.on('disconnected', () => peer.reconnect());
  peer.on('error', e => {
    clearTimeout(to);
    $('lob').textContent = perr(e);
  });
};

// ============================================================
//  TOMBOL: MASUK ROOM
// ============================================================
$('jn').onclick = () => {
  if (!ready()) return;
  isHost = false;
  const id = ($('cd').value || '').trim().toUpperCase();
  if (id.length < 4) {
    $('lob').textContent = 'Isi kode 4 huruf dari temanmu.';
    return;
  }

  if (peer) peer.destroy();
  $('lob').textContent = 'Menghubungi server PeerJS...';
  peer = new Peer();

  const to = setTimeout(() => {
    if (!G.rp.g.visible) {
      $('lob').textContent = 'Belum tersambung setelah 12 detik. Pastikan temanmu sudah membuat room, kodenya benar, dan coba ganti jaringan kalau masih gagal.';
    }
  }, 12000);

  peer.on('open', () => {
    $('lob').textContent = 'Menyambung ke room ' + id + '...';
    const c = peer.connect('desa-' + id);
    setup(c);
  });

  peer.on('error', e => {
    clearTimeout(to);
    $('lob').textContent = perr(e);
  });
};

// ============================================================
//  KIRIM DATA POSISI SETIAP FRAME
// ============================================================
function net(dt) {
  // Kirim posisi
  if (conn && conn.open && G.running) {
    sendT -= dt;
    if (sendT <= 0) {
      sendT = .06;
      conn.send({
        t: 's',
        x: G.px, y: G.py, z: G.pz,
        f: G.face,
        w: Math.hypot(G.vx, G.vz),
        a: G.py > G.H(G.px, G.pz) + .1 ? 1 : 0
      });
    }
  }

  // Interpolasi posisi teman
  if (!G.rp.g.visible) return;
  const g = G.rp.g;
  const k = 1 - Math.exp(-12 * dt);

  g.position.x += (rpT.x - g.position.x) * k;
  g.position.y += (rpT.y - g.position.y) * k;
  g.position.z += (rpT.z - g.position.z) * k;

  // Rotasi
  let d = rpT.f - g.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  g.rotation.y += d * k;

  // Animasi jalan
  rpWalk += dt * rpT.w * 1.6;
  const sw = Math.sin(rpWalk) * Math.min(1, rpT.w / 6) * .9;
  if (rpT.a) {
    G.rp.aL.rotation.x = G.rp.aR.rotation.x = -2.4;
    G.rp.lL.rotation.x = .4;
    G.rp.lR.rotation.x = -.4;
  } else {
    G.rp.aL.rotation.x = sw;
    G.rp.aR.rotation.x = -sw;
    G.rp.lL.rotation.x = -sw;
    G.rp.lR.rotation.x = sw;
  }
}

// ============================================================
//  API UNTUK ring.js
// ============================================================
function sendPunch() {
  if (conn && conn.open) {
    conn.send({ t: 'punch' });

    // Sinkron HP kita ke teman (supaya dia bisa update HP musuh)
    if (R && R.battle) {
      conn.send({ t: 'hp', hp: R.battle.hpMe });
    }
  }
}

function sendKO(win) {
  if (conn && conn.open) {
    conn.send({ t: 'ko', win: !!win });
  }
}

// ============================================================
//  LOOP: dipanggil dari game.js tiap frame
// ============================================================
// game.js seharusnya memanggil MP.net(dt) di dalam loop
// Kalau belum, kita bisa hook manual:
const origNet = window.MP && window.MP.net;
window.MP = {
  net,
  sendPunch,
  sendKO,
  get conn() { return conn; },
  get peer() { return peer; },
  get tOff() { return tOff; },
  get myName() { return myName; }
};

console.log('multiplayer.js loaded ✓');
})();