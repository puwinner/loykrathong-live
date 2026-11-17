// ==========================================================================
// 🪷 LOY KRATHONG LIVE ENGINE v2.5 (Authentic Song, Floating Ritual & River View)
// ==========================================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// World Dimensions matching the background artwork (768 x 1376)
const WORLD_WIDTH = 768;
const WORLD_HEIGHT = 1376;

// Key World Landmark Coordinates
const LANDMARKS = {
  ferrisHub: { x: 646, y: 329, radius: 118 }, // Centered on background wheel
  ferrisGround: { x: 630, y: 580 },            // Ground boarding platform
  buddhaAltar: { x: 300, y: 460 },             // In front of Buddha altar on terrace
  danceStage: { x: 410, y: 745, rx: 68, ry: 32 }, // Circular dance stage
  pierSteps: { x: 420, y: 1045 },              // River stone steps / pier
  riverMinY: 1120,                             // Where Chao Phraya water flows
  riverMaxY: 1280
};

let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Asset Loader
const assets = {
  bg: new Image(),
  vendorStall: new Image(),
  krathong: new Image(),
  chars: {}
};

assets.bg.src = '/static/assets/bg.jpg';
assets.vendorStall.src = '/static/assets/vendor_stall.png';
assets.krathong.src = '/static/assets/krathong.png';

for (let i = 1; i <= 8; i++) {
  assets.chars[i] = new Image();
  assets.chars[i].src = `/static/assets/char_${i}.png`;
}

// Local Player State
let myPlayer = {
  id: null,
  name: 'ผู้ร่วมงาน',
  charType: 1,
  x: 384,
  y: 780,
  targetX: 384,
  targetY: 780,
  action: 'wander',
  chat: '',
  chatTimer: 0,
  walkTimer: 0,
  floatingTimer: 0,
  isRidingFerris: false,
  ferrisSlot: 0,
  ferrisRideTimer: 0
};

// Remote Players & NPCs
const remotePlayers = new Map();
const npcs = new Map();
let krathongs = [];
let lanterns = [];
let particles = [];
let smokeParticles = [];
let waterRipples = [];

// Temple Dog
let dog = {
  x: 180,
  y: 790,
  targetX: 360,
  targetY: 800,
  state: 'idle',
  has_meatball: false,
  animTick: 0
};

// World Animation Timers
let ferrisAngle = 0;
let timeSec = 0;

// ==========================================================================
// 🎵 Authentic Thai Loy Krathong Audio System (Dual: Audio Element + WebAudio Synth)
// ==========================================================================
let audioCtx = null;
let isAudioEnabled = false;
const bgm = document.getElementById('bgm');

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Score of the famous Thai "เพลงลอยกระทง" (124 BPM)
const LK_BEAT = 60 / 124;
const LOY_KRATHONG_SCORE = [
  // 1. วันเพ็ญเดือนสิบสอง
  [392.00, 0.5], [392.00, 0.5], [329.63, 0.5], [392.00, 0.5], [440.00, 1.0], [0, 0.5],
  // 2. น้ำก็นองเต็มตลิ่ง
  [523.25, 0.5], [523.25, 0.5], [440.00, 0.5], [523.25, 0.5], [587.33, 1.0], [0, 0.5],
  // 3. เราทั้งหลายชายหญิง
  [659.25, 0.5], [659.25, 0.5], [659.25, 0.5], [587.33, 0.5], [523.25, 0.5], [587.33, 0.5], [659.25, 1.0],
  // 4. สนุกกันจริงวันลอยกระทง
  [587.33, 0.5], [523.25, 0.5], [440.00, 0.5], [392.00, 0.5], [440.00, 0.5], [523.25, 0.5], [587.33, 0.5], [523.25, 1.0], [0, 0.5],
  // 5. ลอย ลอยกระทง
  [659.25, 0.75], [783.99, 0.75], [659.25, 0.5], [587.33, 0.5], [523.25, 1.0], [0, 0.5],
  // 6. ลอย ลอยกระทง
  [659.25, 0.75], [783.99, 0.75], [659.25, 0.5], [587.33, 0.5], [523.25, 1.0], [0, 0.5],
  // 7. ลอยกระทงกันแล้ว ขอเชิญน้องแก้วออกมารำวง
  [523.25, 0.5], [523.25, 0.5], [587.33, 0.5], [659.25, 0.5], [783.99, 0.5], [659.25, 0.5], [587.33, 0.5], [523.25, 0.5], [440.00, 0.5], [523.25, 0.5], [587.33, 1.0], [0, 0.5],
  // 8. รำวงวันลอยกระทง
  [659.25, 0.75], [783.99, 0.75], [659.25, 0.5], [587.33, 0.5], [523.25, 1.0], [0, 0.5],
  // 9. รำวงวันลอยกระทง
  [659.25, 0.75], [783.99, 0.75], [659.25, 0.5], [587.33, 0.5], [523.25, 1.0], [0, 0.5],
  // 10. บุญจะส่งให้เราสุขใจ
  [587.33, 0.5], [523.25, 0.5], [440.00, 0.5], [392.00, 0.5], [440.00, 0.5], [523.25, 0.5], [587.33, 0.5], [523.25, 1.0], [0, 0.5],
  // 11. บุญจะส่งให้เราสุขใจ
  [587.33, 0.5], [523.25, 0.5], [440.00, 0.5], [392.00, 0.5], [440.00, 0.5], [523.25, 0.5], [587.33, 0.5], [523.25, 1.5], [0, 1.0]
];

let synthScoreIndex = 0;
let synthTimer = null;
let isSynthPlaying = false;

function playRanatNote(freq, duration) {
  if (!isAudioEnabled || !audioCtx || freq <= 0) return;
  try {
    const now = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2.01, now);

    const durSec = duration * LK_BEAT;

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + durSec * 0.95);

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.linearRampToValueAtTime(0.05, now + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + durSec * 0.45);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);

    osc1.start(now);
    osc1.stop(now + durSec);
    osc2.start(now);
    osc2.stop(now + durSec);
  } catch (e) {}
}

function playChing(isChing) {
  if (!isAudioEnabled || !audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    const freq = isChing ? 2850 : 2100;
    const decay = isChing ? 0.75 : 0.09;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + decay);
  } catch (e) {}
}

function stepSynthMusic() {
  if (!isAudioEnabled) {
    isSynthPlaying = false;
    return;
  }
  const item = LOY_KRATHONG_SCORE[synthScoreIndex];
  if (item) {
    const [freq, dur] = item;
    if (freq > 0) {
      playRanatNote(freq, dur);
    }
    if (synthScoreIndex % 2 === 0) {
      playChing(synthScoreIndex % 4 === 0);
    }
    synthScoreIndex = (synthScoreIndex + 1) % LOY_KRATHONG_SCORE.length;
    synthTimer = setTimeout(stepSynthMusic, dur * LK_BEAT * 1000);
  }
}

function startMusic() {
  initAudio();
  isAudioEnabled = true;

  if (bgm) {
    bgm.volume = 0.75;
    bgm.play().then(() => {
      // Clear any synth fallback so authentic MP3 studio audio plays cleanly!
      if (synthTimer) {
        clearTimeout(synthTimer);
        synthTimer = null;
      }
      isSynthPlaying = false;
    }).catch(() => {
      // If browser policy deferred play, wait for next user touch
    });
  }
}

function stopMusic() {
  isAudioEnabled = false;
  if (bgm) {
    try { bgm.pause(); } catch (e) {}
  }
  if (synthTimer) {
    clearTimeout(synthTimer);
    synthTimer = null;
  }
  isSynthPlaying = false;
}

function playTone(freq, duration, type = 'sine', gainVal = 0.08) {
  if (!isAudioEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

function playChime() {
  playTone(523.25, 0.35, 'triangle', 0.1);
  setTimeout(() => playTone(659.25, 0.45, 'triangle', 0.1), 120);
  setTimeout(() => playTone(783.99, 0.7, 'triangle', 0.1), 240);
}

function playSplash() {
  if (!isAudioEnabled || !audioCtx) return;
  try {
    const bufferSize = audioCtx.sampleRate * 0.25;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, audioCtx.currentTime);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
  } catch (e) {}
}

// ==========================================================================
// 🌊 Water Ripples FX System
// ==========================================================================
function addWaterRipple(x, y, maxRadius = 45, color = 'rgba(255, 209, 82, 0.75)') {
  waterRipples.push({
    x: x,
    y: y,
    radius: 4,
    maxRadius: maxRadius,
    alpha: 0.9,
    speed: 24,
    color: color
  });
}

function drawWaterRipples(ctx, dt) {
  for (let i = waterRipples.length - 1; i >= 0; i--) {
    const r = waterRipples[i];
    r.radius += r.speed * dt;
    r.alpha -= dt * 0.42;
    if (r.alpha <= 0 || r.radius >= r.maxRadius) {
      waterRipples.splice(i, 1);
      continue;
    }
    ctx.save();
    const c = r.color.replace(/[\d\.]+\)$/, `${Math.max(0, r.alpha)})`);
    ctx.strokeStyle = c;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.38, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (r.radius > 12) {
      const c2 = r.color.replace(/[\d\.]+\)$/, `${Math.max(0, r.alpha * 0.6)})`);
      ctx.strokeStyle = c2;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.radius * 0.65, r.radius * 0.65 * 0.38, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ==========================================================================
// Resize & Fit Viewport (Contain Mode - Keeps River Fully Above Dock!)
// ==========================================================================
function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;

  const scaleX = canvas.width / WORLD_WIDTH;
  const scaleY = canvas.height / WORLD_HEIGHT;
  scale = Math.min(scaleX, scaleY);

  offsetX = (canvas.width - WORLD_WIDTH * scale) / 2;
  offsetY = (canvas.height - WORLD_HEIGHT * scale) / 2;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

// ==========================================================================
// WebSocket Synchronization
// ==========================================================================
let ws = null;

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Connected to Loy Krathong Live Engine');
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleServerMessage(data);
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 2000);
  };
}

function handleServerMessage(data) {
  if (data.type === 'init_state') {
    myPlayer.id = data.client_id;
    updateOnlineBadge(data.online_count);
    if (data.krathongs) krathongs = data.krathongs;

    if (data.npcs) {
      data.npcs.forEach((npc) => {
        npcs.set(npc.id, {
          id: npc.id,
          name: npc.name,
          charType: npc.char_type,
          x: npc.x || 384,
          y: npc.y || 780,
          targetX: npc.target_x || npc.x || 384,
          targetY: npc.target_y || npc.y || 780,
          action: npc.action || 'wander',
          chat: npc.chat || '',
          chatTimer: 0,
          walkTimer: 0,
          floatingTimer: 0,
          isRidingFerris: false,
          ferrisSlot: Math.random() * Math.PI * 2,
          ferrisRideTimer: 0
        });
      });
    }

    if (data.players) {
      for (const [id, p] of Object.entries(data.players)) {
        if (id !== myPlayer.id) {
          remotePlayers.set(id, {
            id: p.id,
            name: p.name,
            charType: p.char_type,
            x: p.x,
            y: p.y,
            targetX: p.target_x || p.x,
            targetY: p.target_y || p.y,
            action: p.action,
            chat: p.chat || '',
            chatTimer: 0,
            walkTimer: 0,
            floatingTimer: 0,
            isRidingFerris: false,
            ferrisSlot: Math.random() * Math.PI * 2,
            ferrisRideTimer: 0
          });
        }
      }
    }
  } else if (data.type === 'player_joined') {
    updateOnlineBadge(data.online_count);
    if (data.player.id !== myPlayer.id) {
      remotePlayers.set(data.player.id, {
        id: data.player.id,
        name: data.player.name,
        charType: data.player.char_type,
        x: data.player.x,
        y: data.player.y,
        targetX: data.player.target_x || data.player.x,
        targetY: data.player.target_y || data.player.y,
        action: data.player.action,
        chat: data.player.chat || '',
        chatTimer: 3.5,
        walkTimer: 0,
        floatingTimer: 0,
        isRidingFerris: false,
        ferrisSlot: Math.random() * Math.PI * 2,
        ferrisRideTimer: 0
      });
      showToast(`🎉 ${data.player.name} ได้เข้าสู่งานวัด!`);
    }
  } else if (data.type === 'player_left') {
    updateOnlineBadge(data.online_count);
    remotePlayers.delete(data.client_id);
  } else if (data.type === 'player_action') {
    if (data.client_id !== myPlayer.id) {
      const rp = remotePlayers.get(data.client_id);
      if (rp) {
        rp.action = data.action;
        if (data.target_x) rp.targetX = data.target_x;
        if (data.target_y) rp.targetY = data.target_y;
        if (data.action === 'float') {
          rp.floatingTimer = 8.0;
        }
      }
    }
  } else if (data.type === 'npc_action') {
    const npc = npcs.get(data.npc_id);
    if (npc) {
      npc.action = data.action;
      npc.targetX = data.target_x;
      npc.targetY = data.target_y;
      if (data.chat) {
        npc.chat = data.chat;
        npc.chatTimer = 4.0;
      }
    }
  } else if (data.type === 'dog_action') {
    dog.targetX = data.dog.target_x;
    dog.targetY = data.dog.target_y;
    dog.state = data.dog.state;
    dog.has_meatball = data.dog.has_meatball;
  } else if (data.type === 'krathong_added') {
    const k = data.krathong;
    if (k.owner_id === myPlayer.id || (!k.owner_id && myPlayer.floatingTimer > 0)) {
      k.isMine = true;
      showToast(`✨ กระทงของคุณ "${k.name}" ลอยลงสู่แม่น้ำแล้ว! 🪷`);
    } else {
      showToast(`🪷 ${k.name} ได้ปล่อยกระทงลงสู่แม่น้ำ!`);
    }
    krathongs.push(k);

    // Dynamic water ripples and splash at launch spot
    addWaterRipple(k.x, k.y, 55, 'rgba(255, 215, 0, 0.9)');
    setTimeout(() => addWaterRipple(k.x + 8, k.y, 40, 'rgba(79, 172, 254, 0.8)'), 220);
    playSplash();
    playChime();
  } else if (data.type === 'chat_message') {
    if (data.client_id === myPlayer.id) {
      myPlayer.chat = data.message;
      myPlayer.chatTimer = 4.5;
    } else {
      const rp = remotePlayers.get(data.client_id);
      if (rp) {
        rp.chat = data.message;
        rp.chatTimer = 4.5;
      }
    }
  } else if (data.type === 'status_ping') {
    updateOnlineBadge(data.online_count);
  }
}

function sendAction(action, targetX, targetY) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    type: 'player_action',
    action: action,
    target_x: targetX,
    target_y: targetY
  }));
}

function updateOnlineBadge(count) {
  const badge = document.getElementById('onlineCount');
  if (badge) badge.innerText = count || 1;
}

function showToast(text) {
  const toast = document.getElementById('eventToast');
  if (!toast) return;
  toast.innerText = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ==========================================================================
// Rendering Layers
// ==========================================================================

// 1. Background Art
function drawBackground(ctx) {
  if (assets.bg.complete && assets.bg.naturalWidth > 0) {
    ctx.drawImage(assets.bg, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    grad.addColorStop(0, '#060a17');
    grad.addColorStop(0.5, '#1e142e');
    grad.addColorStop(1, '#061324');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
}

// 2. Animated Ferris Wheel Fairy Lights around rim
function drawFerrisLights(ctx) {
  const fx = LANDMARKS.ferrisHub.x;
  const fy = LANDMARKS.ferrisHub.y;
  const radius = LANDMARKS.ferrisHub.radius;

  ctx.save();
  for (let i = 0; i < 24; i++) {
    const angle = ferrisAngle + (i * 2 * Math.PI) / 24;
    const px = fx + Math.cos(angle) * radius;
    const py = fy + Math.sin(angle) * radius;
    const bulbColor = (i % 2 === Math.floor(timeSec * 5) % 2) ? '#ff0077' : '#00ffff';
    ctx.fillStyle = bulbColor;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 3. Vendor Stall (ร้านลูกชิ้นปิ้ง) with Auntie & Sizzling Charcoal Smoke
function drawVendorStall(ctx) {
  const sx = 40;
  const sy = 690;
  const sw = 165;
  const sh = 190;

  if (assets.vendorStall.complete && assets.vendorStall.naturalWidth > 0) {
    ctx.drawImage(assets.vendorStall, sx, sy, sw, sh);
  }

  // Charcoal Smoke Particles
  if (Math.random() < 0.35) {
    smokeParticles.push({
      x: sx + 95 + (Math.random() * 20 - 10),
      y: sy + 115,
      vx: (Math.random() - 0.5) * 8,
      vy: -15 - Math.random() * 12,
      size: 4 + Math.random() * 6,
      alpha: 0.6
    });
  }

  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    const sp = smokeParticles[i];
    sp.x += sp.vx * 0.05;
    sp.y += sp.vy * 0.05;
    sp.size += 0.15;
    sp.alpha -= 0.01;
    if (sp.alpha <= 0) {
      smokeParticles.splice(i, 1);
      continue;
    }
    ctx.fillStyle = `rgba(220, 220, 230, ${sp.alpha})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 4. Temple Dog (หมาวัด เจ้าตูบ)
function drawTempleDog(ctx) {
  ctx.save();
  ctx.translate(dog.x, dog.y);

  const isMoving = Math.abs(dog.targetX - dog.x) > 2 || Math.abs(dog.targetY - dog.y) > 2;
  const dir = (dog.targetX >= dog.x) ? 1 : -1;
  ctx.scale(dir, 1);

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dog Body
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.roundRect(-12, -4, 24, 14, 6);
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.arc(12, -5, 8, 0, Math.PI * 2);
  ctx.fill();

  // Ear
  ctx.fillStyle = '#962d22';
  ctx.beginPath();
  ctx.ellipse(9, -8, 3, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = '#fed330';
  ctx.beginPath();
  ctx.arc(17, -3, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(19, -4, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Legs walking
  const legOffset = isMoving ? Math.sin(timeSec * 14) * 4 : 0;
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-8 + legOffset, 8, 3.5, 7);
  ctx.fillRect(-2 - legOffset, 8, 3.5, 7);
  ctx.fillRect(5 + legOffset, 8, 3.5, 7);
  ctx.fillRect(10 - legOffset, 8, 3.5, 7);

  // Tail
  const tailWag = Math.sin(timeSec * 16) * 5;
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.quadraticCurveTo(-20, -10 + tailWag, -18, -14 + tailWag);
  ctx.stroke();

  // Stolen meatball skewer
  if (dog.has_meatball) {
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(15, -2);
    ctx.lineTo(34, -2);
    ctx.stroke();

    ctx.fillStyle = '#b33939';
    ctx.beginPath();
    ctx.arc(22, -2, 3, 0, Math.PI * 2);
    ctx.arc(28, -2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// 5. Chibi Character Drawing (with Walk, Pray, Dance, Kneeling Floating Krathong Poses)
function drawCharacter(ctx, char) {
  ctx.save();
  ctx.translate(char.x, char.y);

  const isMoving = Math.abs(char.targetX - char.x) > 3 || Math.abs(char.targetY - char.y) > 3;
  const walkBob = (isMoving && !char.isRidingFerris) ? Math.sin(char.walkTimer * 8) * 4 : 0;
  const danceBob = (char.action === 'dance') ? Math.sin(timeSec * 7) * 4 : 0;
  const tilt = (isMoving && !char.isRidingFerris) ? Math.sin(char.walkTimer * 8) * 0.08 : 0;

  ctx.translate(0, walkBob + danceBob);
  ctx.rotate(tilt);

  // Shadow only if firmly on the ground (not riding ferris)
  if (!char.isRidingFerris) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 24, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Floating Krathong ritual at river steps
  const isFloatingAction = (char.action === 'float');
  const isAtWaterEdge = isFloatingAction && Math.hypot(char.targetX - char.x, char.targetY - char.y) < 14;

  if (isAtWaterEdge) {
    // Kneeling down gently by the water
    ctx.translate(0, 8);
    ctx.scale(1, 0.86);

    // Warm divine radiance aura
    const auraGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 36);
    auraGrad.addColorStop(0, 'rgba(255, 215, 0, 0.45)');
    auraGrad.addColorStop(0.6, 'rgba(255, 180, 0, 0.15)');
    auraGrad.addColorStop(1, 'rgba(255, 180, 0, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw High-Resolution Character Sprite
  const sprite = assets.chars[char.charType] || assets.chars[1];
  const charW = 54;
  const charH = 64;

  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    ctx.drawImage(sprite, -charW / 2, -charH + 24, charW, charH);
  } else {
    ctx.fillStyle = '#ff6b8b';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // If kneeling at water edge, show small held krathong in hands
  if (isAtWaterEdge) {
    if (assets.krathong.complete && assets.krathong.naturalWidth > 0) {
      ctx.drawImage(assets.krathong, -16, 6, 32, 30);
    }
    // Sparkling particles over head
    ctx.fillStyle = '#ffd152';
    ctx.font = 'bold 12px Prompt';
    ctx.textAlign = 'center';
    ctx.fillText('🪷 กำลังปล่อยกระทง...', 0, -42);
  } else if (isFloatingAction) {
    // Walking down to the water
    ctx.fillStyle = '#4facfe';
    ctx.font = 'bold 11px Prompt';
    ctx.textAlign = 'center';
    ctx.fillText('🚶 ลงท่าน้ำ', 0, -42);
  }

  // Praying 🙏 effect at Buddha shrine
  if (char.action === 'pray') {
    ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(0, -10, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffd152';
    ctx.font = 'bold 12px Prompt';
    ctx.textAlign = 'center';
    ctx.fillText('🙏', 0, -42);
  }

  // Dancing 💃 Thai Ramwong effect
  if (char.action === 'dance') {
    ctx.fillStyle = 'rgba(255, 107, 139, 0.25)';
    ctx.beginPath();
    ctx.arc(0, -10, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff6b8b';
    ctx.font = 'bold 11px Prompt';
    ctx.textAlign = 'center';
    ctx.fillText('💃', 0, -42);
  }

  // Name Tag
  ctx.fillStyle = 'rgba(6, 10, 23, 0.78)';
  ctx.beginPath();
  ctx.roundRect(-40, -54, 80, 16, 8);
  ctx.fill();

  ctx.fillStyle = char.isSelf ? '#ffd152' : '#ffffff';
  ctx.font = 'bold 9.5px Prompt';
  ctx.textAlign = 'center';
  ctx.fillText(char.name, 0, -42.5);

  // Self Indicator Golden Arrow
  if (char.isSelf) {
    ctx.fillStyle = '#ffd152';
    ctx.beginPath();
    ctx.moveTo(0, -64);
    ctx.lineTo(-5, -72);
    ctx.lineTo(5, -72);
    ctx.closePath();
    ctx.fill();
  }

  // Chat Speech Bubble
  if (char.chat && char.chat.trim().length > 0) {
    const text = char.chat;
    ctx.font = '11px Prompt';
    const textW = ctx.measureText(text).width;
    const bubbleW = Math.max(textW + 18, 55);
    const bubbleH = 24;
    const bx = -bubbleW / 2;
    const by = -90;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bubbleW, bubbleH, 8);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-4, by + bubbleH);
    ctx.lineTo(0, by + bubbleH + 6);
    ctx.lineTo(4, by + bubbleH);
    ctx.fill();

    ctx.fillStyle = '#1e272e';
    ctx.textAlign = 'center';
    ctx.fillText(text, 0, by + 16);
  }

  ctx.restore();
}

// 6. Realistic River Water Reflections (Water region Y >= 1110)
function drawRiverReflections(ctx) {
  const waterY = 1110;

  ctx.save();
  // Translucent moonlight shimmering waves
  for (let layer = 0; layer < 3; layer++) {
    const wy = waterY + 25 + layer * 55;
    const speed = (layer % 2 === 0) ? 1.6 : -1.2;
    ctx.fillStyle = (layer % 2 === 0) ? 'rgba(79, 172, 254, 0.12)' : 'rgba(255, 209, 82, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, wy);
    for (let x = 0; x <= WORLD_WIDTH; x += 30) {
      const dy = Math.sin((x * 0.02) + (timeSec * speed) + (layer * 1.5)) * 4;
      ctx.lineTo(x, wy + dy);
    }
    ctx.lineTo(WORLD_WIDTH, wy + 16);
    ctx.lineTo(0, wy + 16);
    ctx.closePath();
    ctx.fill();
  }

  // Golden moonlight reflection shimmer
  const moonRefX = 360;
  const refGrad = ctx.createRadialGradient(moonRefX, 1180, 10, moonRefX, 1180, 120);
  refGrad.addColorStop(0, 'rgba(255, 230, 120, 0.18)');
  refGrad.addColorStop(0.5, 'rgba(255, 200, 60, 0.08)');
  refGrad.addColorStop(1, 'rgba(255, 200, 60, 0)');
  ctx.fillStyle = refGrad;
  ctx.fillRect(moonRefX - 120, 1110, 240, 240);

  ctx.restore();
}

// 7. Floating Krathongs (STRICTLY in the river Y >= 1120) with Special Highlight for Player
function drawFloatingKrathong(ctx, k) {
  ctx.save();
  ctx.translate(k.x, k.y);

  const isMyKrathong = (k.owner_id && k.owner_id === myPlayer.id) || k.isMine;

  // Gentle water bobbing and rocking
  const bobY = Math.sin(timeSec * 2.8 + k.x * 0.08) * 3.5;
  const rockAngle = Math.sin(timeSec * 2.2 + k.x * 0.05) * 0.04;
  ctx.translate(0, bobY);
  ctx.rotate(rockAngle);

  // If this is the player's own krathong, render divine light beam & pointer
  if (isMyKrathong) {
    // 1. Vertical golden beam shooting towards heaven
    const beamGrad = ctx.createLinearGradient(0, -20, 0, -180);
    beamGrad.addColorStop(0, 'rgba(255, 215, 0, 0.55)');
    beamGrad.addColorStop(0.5, 'rgba(255, 230, 100, 0.2)');
    beamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(-10, -20);
    ctx.lineTo(10, -20);
    ctx.lineTo(24, -180);
    ctx.lineTo(-24, -180);
    ctx.closePath();
    ctx.fill();

    // 2. Pulsating golden beacon ring on the water
    const beaconPulse = Math.sin(timeSec * 5) * 6;
    ctx.strokeStyle = '#ffd152';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 14, 38 + beaconPulse, 16 + beaconPulse * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Floating pointer arrow
    const arrowBob = Math.sin(timeSec * 6) * 4;
    ctx.fillStyle = '#ffd152';
    ctx.font = 'bold 11px Prompt';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 6;
    ctx.fillText('✨ กระทงของคุณ ✨', 0, -52 + arrowBob);
    ctx.font = '13px Prompt';
    ctx.fillText('▼', 0, -38 + arrowBob);
    ctx.shadowBlur = 0;
  }

  // Warm candlelight glow cast on the water surface
  const waterGlow = ctx.createRadialGradient(0, 12, 4, 0, 12, isMyKrathong ? 58 : 48);
  waterGlow.addColorStop(0, isMyKrathong ? 'rgba(255, 215, 60, 0.85)' : 'rgba(255, 190, 60, 0.65)');
  waterGlow.addColorStop(0.5, isMyKrathong ? 'rgba(255, 160, 0, 0.38)' : 'rgba(255, 120, 0, 0.28)');
  waterGlow.addColorStop(1, 'rgba(255, 90, 0, 0)');
  ctx.fillStyle = waterGlow;
  ctx.beginPath();
  ctx.ellipse(0, 14, isMyKrathong ? 58 : 48, isMyKrathong ? 24 : 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Krathong High-Resolution Sprite
  const kw = isMyKrathong ? 74 : 68;
  const kh = isMyKrathong ? 70 : 64;
  if (assets.krathong.complete && assets.krathong.naturalWidth > 0) {
    ctx.drawImage(assets.krathong, -kw / 2, -kh / 2 - 4, kw, kh);
  } else {
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff758f';
    ctx.beginPath();
    ctx.ellipse(0, -3, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Active Candle Flame Flickering Particles
  const flameGlow = ctx.createRadialGradient(2, -24, 2, 2, -24, 24);
  flameGlow.addColorStop(0, 'rgba(255, 255, 200, 0.98)');
  flameGlow.addColorStop(0.4, 'rgba(255, 160, 0, 0.65)');
  flameGlow.addColorStop(1, 'rgba(255, 90, 0, 0)');
  ctx.fillStyle = flameGlow;
  ctx.beginPath();
  ctx.arc(2, -24, 24, 0, Math.PI * 2);
  ctx.fill();

  // Flame teardrop
  ctx.fillStyle = '#fffdf0';
  ctx.beginPath();
  ctx.ellipse(2, -24, 2.8, 5.5 + Math.sin(timeSec * 12) * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Name Tag
  if (isMyKrathong) {
    ctx.fillStyle = 'rgba(255, 190, 0, 0.92)';
    ctx.beginPath();
    ctx.roundRect(-50, 20, 100, 18, 9);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#1e142e';
    ctx.font = 'bold 10px Prompt';
    ctx.textAlign = 'center';
    ctx.fillText(`✨ ${k.name} (คุณ)`, 0, 33);
  } else {
    ctx.fillStyle = 'rgba(6, 10, 23, 0.8)';
    ctx.beginPath();
    ctx.roundRect(-40, 20, 80, 16, 8);
    ctx.fill();

    ctx.fillStyle = '#ffd152';
    ctx.font = 'bold 9.5px Prompt';
    ctx.textAlign = 'center';
    ctx.fillText(k.name || 'กระทง', 0, 32);
  }

  ctx.restore();
}

// 8. Sky Lanterns (โคมลอย)
function spawnLantern(x, y) {
  lanterns.push({
    x: x,
    y: y,
    speedY: 28 + Math.random() * 22,
    sway: Math.random() * Math.PI * 2,
    size: 16 + Math.random() * 10,
    alpha: 1.0
  });
}

function drawLanterns(ctx, dt) {
  for (let i = lanterns.length - 1; i >= 0; i--) {
    const l = lanterns[i];
    l.y -= l.speedY * dt;
    l.x += Math.sin(timeSec * 2 + l.sway) * 0.5;

    if (l.y < 80) l.alpha -= dt * 0.4;
    if (l.alpha <= 0 || l.y < -30) {
      lanterns.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, l.alpha);
    ctx.translate(l.x, l.y);

    const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, l.size * 2);
    glow.addColorStop(0, 'rgba(255, 230, 120, 0.9)');
    glow.addColorStop(0.5, 'rgba(255, 120, 0, 0.4)');
    glow.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, l.size * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff6d6';
    ctx.beginPath();
    ctx.roundRect(-l.size * 0.5, -l.size * 0.7, l.size, l.size * 1.3, 4);
    ctx.fill();

    ctx.fillStyle = '#ff7700';
    ctx.beginPath();
    ctx.ellipse(0, l.size * 0.55, l.size * 0.35, l.size * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// 9. Sparklers (ไฟเย็น)
function spawnSparklers(x, y) {
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 90;
    particles.push({
      x: x,
      y: y - 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: ['#ffd152', '#ff6b8b', '#4facfe', '#ffffff', '#00f2fe'][Math.floor(Math.random() * 5)],
      life: 0.6 + Math.random() * 0.6,
      maxLife: 1.0,
      size: 2.5 + Math.random() * 2.5
    });
  }
}

function drawParticles(ctx, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 50 * dt;

    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

// ==========================================================================
// Update Loop & Physics
// ==========================================================================
let lastTimestamp = performance.now();

function updateCharacterPosition(char, dt) {
  // Check Ferris Wheel Riding Behavior
  if (char.action === 'ferris') {
    if (!char.isRidingFerris) {
      // Walk to ground platform first
      const fdx = LANDMARKS.ferrisGround.x - char.x;
      const fdy = LANDMARKS.ferrisGround.y - char.y;
      const fdist = Math.hypot(fdx, fdy);
      if (fdist > 5) {
        char.x += (fdx / fdist) * 90 * dt;
        char.y += (fdy / fdist) * 90 * dt;
        char.walkTimer = (char.walkTimer || 0) + dt;
      } else {
        // Reached platform, board the ferris wheel cabin!
        char.isRidingFerris = true;
        char.ferrisRideTimer = 16.0;
        char.ferrisSlot = char.ferrisSlot || Math.random() * Math.PI * 2;
      }
    } else {
      // Actively riding inside a gondola cabin!
      char.ferrisRideTimer -= dt;
      const angle = ferrisAngle + char.ferrisSlot;
      char.x = LANDMARKS.ferrisHub.x + Math.cos(angle) * LANDMARKS.ferrisHub.radius;
      char.y = LANDMARKS.ferrisHub.y + Math.sin(angle) * LANDMARKS.ferrisHub.radius + 10;

      // Finished ride, alight back to ground!
      if (char.ferrisRideTimer <= 0) {
        char.isRidingFerris = false;
        char.action = 'wander';
        char.targetX = LANDMARKS.ferrisGround.x + (Math.random() * 40 - 20);
        char.targetY = LANDMARKS.ferrisGround.y + (Math.random() * 30);
      }
    }
    return;
  } else {
    char.isRidingFerris = false;
  }

  // Floating Krathong Ritual duration check
  if (char.action === 'float') {
    if (char.floatingTimer > 0) {
      char.floatingTimer -= dt;
      if (char.floatingTimer <= 0) {
        char.action = 'wander';
        char.targetX = 384 + (Math.random() * 80 - 40);
        char.targetY = 820;
      }
    }
  }

  // Normal / Dancing / Walking towards Target
  const dx = char.targetX - char.x;
  const dy = char.targetY - char.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 2) {
    const isDancing = char.action === 'dance';
    const speed = isDancing ? (dist > 35 ? 105 : 75) : 88;
    char.x += (dx / dist) * speed * dt;
    char.y += (dy / dist) * speed * dt;
    char.walkTimer = (char.walkTimer || 0) + dt;
  }

  if (char.chatTimer > 0) {
    char.chatTimer -= dt;
    if (char.chatTimer <= 0) char.chat = '';
  }
}

function update(dt) {
  timeSec += dt;
  ferrisAngle += dt * 0.38;

  // Synchronize Ramwong Dance Ring (No overlapping!)
  const activeDancers = [];
  if (myPlayer.id && myPlayer.action === 'dance') activeDancers.push(myPlayer);
  remotePlayers.forEach((rp) => { if (rp.action === 'dance') activeDancers.push(rp); });
  npcs.forEach((npc) => { if (npc.action === 'dance') activeDancers.push(npc); });

  const numDancers = activeDancers.length;
  activeDancers.forEach((dancer, idx) => {
    const slotAngle = (idx * 2 * Math.PI) / numDancers;
    const danceSpeed = 0.95;
    const currentAngle = timeSec * danceSpeed + slotAngle;

    dancer.targetX = LANDMARKS.danceStage.x + Math.cos(currentAngle) * LANDMARKS.danceStage.rx;
    dancer.targetY = LANDMARKS.danceStage.y + Math.sin(currentAngle) * LANDMARKS.danceStage.ry;
  });

  // Update Local Player
  updateCharacterPosition(myPlayer, dt);

  // Update Remote Players
  remotePlayers.forEach((rp) => updateCharacterPosition(rp, dt));

  // Update NPCs
  npcs.forEach((npc) => updateCharacterPosition(npc, dt));

  // Update Dog
  const ddx = dog.targetX - dog.x;
  const ddy = dog.targetY - dog.y;
  const ddist = Math.hypot(ddx, ddy);
  if (ddist > 3) {
    const dogSpeed = dog.has_meatball ? 135 : 75;
    dog.x += (ddx / ddist) * dogSpeed * dt;
    dog.y += (ddy / ddist) * dogSpeed * dt;
  }

  // Krathongs gently floating in the river from left to right (Peaceful & uncluttered)
  for (let i = krathongs.length - 1; i >= 0; i--) {
    const k = krathongs[i];
    k.x += (k.speed || 17) * dt;

    // When reaching the right edge of the screen:
    if (k.x > WORLD_WIDTH + 60) {
      const isMyKrathong = (k.owner_id && k.owner_id === myPlayer.id) || k.isMine;
      // If there are more than 4 krathongs in the river, let older dummy krathongs drift away
      if (!isMyKrathong && krathongs.length > 4) {
        krathongs.splice(i, 1);
      } else {
        k.x = -60;
        k.y = LANDMARKS.riverMinY + 20 + Math.random() * (LANDMARKS.riverMaxY - LANDMARKS.riverMinY - 40);
      }
    }
  }
}

// ==========================================================================
// Main Render Loop
// ==========================================================================
function render() {
  const now = performance.now();
  const dt = Math.min((now - lastTimestamp) / 1000, 0.1);
  lastTimestamp = now;

  update(dt);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // 1. Full Background Scene (Moon, Temple, Riverbank)
  drawBackground(ctx);

  // 2. Animated Ferris Wheel Lights
  drawFerrisLights(ctx);

  // 3. Vendor Stall (ร้านลูกชิ้นปิ้ง)
  drawVendorStall(ctx);

  // 4. Temple Dog
  drawTempleDog(ctx);

  // 5. Characters (Sorted by Y for correct perspective)
  const allCharacters = [];
  if (myPlayer.id) {
    allCharacters.push({ ...myPlayer, isSelf: true });
  }
  remotePlayers.forEach((rp) => allCharacters.push({ ...rp, isSelf: false }));
  npcs.forEach((npc) => allCharacters.push({ ...npc, isSelf: false }));

  allCharacters.sort((a, b) => a.y - b.y);
  allCharacters.forEach((char) => drawCharacter(ctx, char));

  // 6. River Reflections & Waves (Y >= 1110)
  drawRiverReflections(ctx);

  // 6.1 Water Ripples FX
  drawWaterRipples(ctx, dt);

  // 7. Floating Krathongs (STRICTLY in river water!)
  krathongs.forEach((k) => drawFloatingKrathong(ctx, k));

  // 8. Lanterns & Sparkler particles
  drawLanterns(ctx, dt);
  drawParticles(ctx, dt);

  ctx.restore();

  requestAnimationFrame(render);
}

// ==========================================================================
// Touch & Click Interaction
// ==========================================================================
function getCanvasCoords(event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;

  const canvasX = (clientX - rect.left) * window.devicePixelRatio;
  const canvasY = (clientY - rect.top) * window.devicePixelRatio;

  const worldX = (canvasX - offsetX) / scale;
  const worldY = (canvasY - offsetY) / scale;

  return { x: worldX, y: worldY };
}

canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = getCanvasCoords(e);

  // Tap on Krathong in river to read wish!
  let clickedKrathong = null;
  for (const k of krathongs) {
    if (Math.hypot(k.x - x, k.y - y) < 42) {
      clickedKrathong = k;
      break;
    }
  }

  if (clickedKrathong) {
    openKrathongCard(clickedKrathong);
    return;
  }

  // Walk in festival plaza (Paved areas: Y 540 to 1050)
  if (y >= 540 && y <= 1050 && x >= 120 && x <= 660) {
    myPlayer.targetX = x;
    myPlayer.targetY = y;
    myPlayer.action = 'wander';
    myPlayer.isRidingFerris = false;
    sendAction('wander', x, y);
  }
});

// ==========================================================================
// UI Modals & Actions
// ==========================================================================
const welcomeModal = document.getElementById('welcomeModal');
const avatarGrid = document.getElementById('avatarGrid');
const btnEnterFestival = document.getElementById('btnEnterFestival');
const userNameInput = document.getElementById('userNameInput');

let selectedAvatarType = 1;
avatarGrid.addEventListener('click', (e) => {
  const item = e.target.closest('.avatar-item');
  if (!item) return;
  document.querySelectorAll('.avatar-item').forEach(el => el.classList.remove('selected'));
  item.classList.add('selected');
  selectedAvatarType = parseInt(item.getAttribute('data-type'));
});

btnEnterFestival.addEventListener('click', () => {
  startMusic();
  const name = userNameInput.value.trim() || 'ผู้ร่วมงาน';
  myPlayer.name = name;
  myPlayer.charType = selectedAvatarType;

  welcomeModal.classList.remove('active');

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'join',
      name: name,
      char_type: selectedAvatarType
    }));
  }

  playChime();
  showToast(`ยินดีต้อนรับ ${name} สู่งานลอยกระทงสด! 🪷`);
});

// Float Krathong Modal
const floatModal = document.getElementById('floatModal');
const btnOpenFloatModal = document.getElementById('btnOpenFloatModal');
const btnCloseFloatModal = document.getElementById('btnCloseFloatModal');
const btnConfirmFloat = document.getElementById('btnConfirmFloat');
const wishInput = document.getElementById('wishInput');

document.querySelectorAll('.wish-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    wishInput.value = tag.getAttribute('data-text');
  });
});

btnOpenFloatModal.addEventListener('click', () => {
  floatModal.classList.add('active');
});

btnCloseFloatModal.addEventListener('click', () => {
  floatModal.classList.remove('active');
});

btnConfirmFloat.addEventListener('click', () => {
  const wish = wishInput.value.trim() || 'ขอให้ชีวิตร่มเย็นเป็นสุข ไร้โรคภัย สมหวังทุกประการ';
  floatModal.classList.remove('active');

  // Walk player down to the stone steps / pier right at the river edge
  const pierTargetX = 420 + (Math.random() * 40 - 20);
  const pierTargetY = 1045;
  myPlayer.targetX = pierTargetX;
  myPlayer.targetY = pierTargetY;
  myPlayer.action = 'float';
  myPlayer.isRidingFerris = false;
  myPlayer.floatingTimer = 8.0;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'float_krathong',
      wish: wish,
      krathong_type: 1
    }));
  }

  showToast(`🪷 กำลังเดินลงท่าน้ำเพื่อปล่อยกระทงลงสู่แม่น้ำเจ้าพระยา...`);
  wishInput.value = '';
});

// Quick Festival Activities
document.querySelector('.activity-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('.activity-btn');
  if (!btn) return;
  const action = btn.getAttribute('data-action');

  if (action === 'pray') {
    myPlayer.targetX = LANDMARKS.buddhaAltar.x + (Math.random() * 30 - 15);
    myPlayer.targetY = LANDMARKS.buddhaAltar.y;
    myPlayer.action = 'pray';
    myPlayer.isRidingFerris = false;
    sendAction('pray', myPlayer.targetX, myPlayer.targetY);
    playChime();
    showToast('🙏 คุณได้เดินมากราบพระพุทธรูปเพื่อความเป็นสิริมงคล');
  } else if (action === 'dance') {
    myPlayer.targetX = LANDMARKS.danceStage.x;
    myPlayer.targetY = LANDMARKS.danceStage.y;
    myPlayer.action = 'dance';
    myPlayer.isRidingFerris = false;
    sendAction('dance', myPlayer.targetX, myPlayer.targetY);
    showToast('💃 คุณขึ้นไปร่วมสนุกบนเวทีรำวง!');
  } else if (action === 'ferris') {
    myPlayer.targetX = LANDMARKS.ferrisGround.x;
    myPlayer.targetY = LANDMARKS.ferrisGround.y;
    myPlayer.action = 'ferris';
    myPlayer.isRidingFerris = false;
    sendAction('ferris', LANDMARKS.ferrisGround.x, LANDMARKS.ferrisGround.y);
    showToast('🎡 คุณเดินไปขึ้นชิงช้าสวรรค์');
  } else if (action === 'lantern') {
    spawnLantern(myPlayer.x, myPlayer.y - 15);
    playTone(600, 0.4, 'sine', 0.08);
    showToast('🏮 คุณได้ปล่อยโคมลอยขึ้นสู่ดวงจันทร์');
  } else if (action === 'sparkler') {
    spawnSparklers(myPlayer.x, myPlayer.y);
    playTone(800, 0.2, 'sawtooth', 0.05);
    showToast('✨ คุณจุดไฟเย็นส่องประกายสดใส!');
  } else if (action === 'dog') {
    dog.targetX = 140;
    dog.targetY = 780;
    dog.has_meatball = true;
    showToast('🐕 หมาวัดแอบขโมยลูกชิ้นวิ่งหนีไปแล้ว!');
  }
});

// Chat Form
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'chat',
      message: text
    }));
  }

  myPlayer.chat = text;
  myPlayer.chatTimer = 4.5;
  chatInput.value = '';
});

// Krathong Reader Card
const krathongCard = document.getElementById('krathongCard');
const cardAuthor = document.getElementById('cardAuthor');
const cardWish = document.getElementById('cardWish');
const btnCloseCard = document.getElementById('btnCloseCard');
const btnBless = document.getElementById('btnBless');

function openKrathongCard(k) {
  cardAuthor.innerText = `กระทงของ ${k.name || 'ผู้ร่วมงาน'}`;
  cardWish.innerText = `"${k.wish || 'ขอให้อยู่เย็นเป็นสุข'}"`;
  krathongCard.style.display = 'block';
  playTone(440, 0.2, 'triangle', 0.06);
}

btnCloseCard.addEventListener('click', () => {
  krathongCard.style.display = 'none';
});

btnBless.addEventListener('click', () => {
  btnBless.innerText = '🙏 สาธุแล้ว! ขอให้สมปรารถนา';
  playChime();
  setTimeout(() => {
    krathongCard.style.display = 'none';
    btnBless.innerText = '🙏 ร่วมอนุโมทนา สาธุ (+1)';
  }, 1200);
});

// Audio & Fullscreen Buttons
const btnAudio = document.getElementById('btnAudio');
btnAudio.addEventListener('click', () => {
  if (isAudioEnabled) {
    stopMusic();
    btnAudio.innerText = '🔇';
    showToast('🔇 ปิดเสียง');
  } else {
    startMusic();
    btnAudio.innerText = '🔊';
    showToast('🎵 กำลังเล่นเพลงลอยกระทง');
  }
});

const btnFullscreen = document.getElementById('btnFullscreen');
btnFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

// Toggle Bottom Dock (Collapse / Expand to see the river freely!)
const btnToggleDock = document.getElementById('btnToggleDock');
const bottomDock = document.getElementById('bottomDock');
if (btnToggleDock && bottomDock) {
  btnToggleDock.addEventListener('click', () => {
    bottomDock.classList.toggle('collapsed');
    const isCollapsed = bottomDock.classList.contains('collapsed');
    btnToggleDock.innerText = isCollapsed ? '▴ แสดงเมนู' : '▾ ย่อเมนู';
    resize();
    setTimeout(resize, 150);
  });
}

// Start Engine
connectWebSocket();
requestAnimationFrame(render);
