// ==========================================================================
// 🪷 LOY KRATHONG LIVE ENGINE v2.1 (Accurate Ground & Water Physics)
// ==========================================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// World Dimensions matching the background artwork (768 x 1376)
const WORLD_WIDTH = 768;
const WORLD_HEIGHT = 1376;

// Key World Landmark Coordinates
const LANDMARKS = {
  ferrisHub: { x: 646, y: 329, radius: 118 }, // Exactly centered on background wheel
  ferrisGround: { x: 630, y: 580 },            // Ground boarding platform
  buddhaAltar: { x: 300, y: 460 },             // In front of Buddha altar on stone terrace
  danceStage: { x: 410, y: 745, rx: 68, ry: 32 }, // Circular dance stage (spacious ring)
  pierSteps: { x: 420, y: 1040 },               // Stone steps at river's edge
  riverMinY: 1130,                             // Where river water starts
  riverMaxY: 1250
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

// Audio System
let audioCtx = null;
let isAudioEnabled = false;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
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
}

// Background soundscape
let musicStep = 0;
const thaiScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
setInterval(() => {
  if (isAudioEnabled && audioCtx) {
    if (musicStep % 2 === 0) {
      const note = thaiScale[Math.floor(Math.random() * thaiScale.length)];
      playTone(note, 0.35, 'sine', 0.03);
    }
    musicStep++;
  }
}, 550);

// ==========================================================================
// Resize & Fit Viewport (Contain Mode)
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
    krathongs.push(data.krathong);
    showToast(`🪷 ${data.krathong.name} ได้ปล่อยกระทงลงสู่แม่น้ำ!`);
    playSplash();
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

// 5. Chibi Character Drawing
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

// 6. Realistic River Water Reflections (ONLY in water region Y >= 1100)
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

// 7. Floating Krathongs (STRICTLY in the river Y >= 1120)
function drawFloatingKrathong(ctx, k) {
  ctx.save();
  ctx.translate(k.x, k.y);

  // Gentle water bobbing and rocking
  const bobY = Math.sin(timeSec * 2.8 + k.x * 0.08) * 3.5;
  const rockAngle = Math.sin(timeSec * 2.2 + k.x * 0.05) * 0.04;
  ctx.translate(0, bobY);
  ctx.rotate(rockAngle);

  // Warm candlelight glow cast on the water surface
  const waterGlow = ctx.createRadialGradient(0, 12, 4, 0, 12, 48);
  waterGlow.addColorStop(0, 'rgba(255, 190, 60, 0.65)');
  waterGlow.addColorStop(0.5, 'rgba(255, 120, 0, 0.28)');
  waterGlow.addColorStop(1, 'rgba(255, 90, 0, 0)');
  ctx.fillStyle = waterGlow;
  ctx.beginPath();
  ctx.ellipse(0, 14, 48, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Krathong High-Resolution Sprite
  const kw = 68;
  const kh = 64;
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
  const flameGlow = ctx.createRadialGradient(2, -24, 2, 2, -24, 22);
  flameGlow.addColorStop(0, 'rgba(255, 255, 200, 0.95)');
  flameGlow.addColorStop(0.4, 'rgba(255, 150, 0, 0.6)');
  flameGlow.addColorStop(1, 'rgba(255, 90, 0, 0)');
  ctx.fillStyle = flameGlow;
  ctx.beginPath();
  ctx.arc(2, -24, 22, 0, Math.PI * 2);
  ctx.fill();

  // Flame teardrop
  ctx.fillStyle = '#fffdf0';
  ctx.beginPath();
  ctx.ellipse(2, -24, 2.5, 5 + Math.sin(timeSec * 12) * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Name Tag
  ctx.fillStyle = 'rgba(6, 10, 23, 0.8)';
  ctx.beginPath();
  ctx.roundRect(-40, 20, 80, 16, 8);
  ctx.fill();

  ctx.fillStyle = '#ffd152';
  ctx.font = 'bold 9.5px Prompt';
  ctx.textAlign = 'center';
  ctx.fillText(k.name || 'กระทง', 0, 32);

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
        char.ferrisRideTimer = 16.0; // ride for 16 seconds
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

  // Normal / Dancing Walking towards Target
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
  ferrisAngle += dt * 0.38; // Ferris wheel gentle rotation

  // Synchronize Ramwong Dance Ring (Distribute all active dancers evenly around circle so they never overlap!)
  const activeDancers = [];
  if (myPlayer.id && myPlayer.action === 'dance') activeDancers.push(myPlayer);
  remotePlayers.forEach((rp) => { if (rp.action === 'dance') activeDancers.push(rp); });
  npcs.forEach((npc) => { if (npc.action === 'dance') activeDancers.push(npc); });

  const numDancers = activeDancers.length;
  activeDancers.forEach((dancer, idx) => {
    // Equidistant slot angle (e.g. 2 dancers = 180°, 3 = 120°, 4 = 90°, 6 = 60°...)
    const slotAngle = (idx * 2 * Math.PI) / numDancers;
    const danceSpeed = 0.95; // Graceful traditional Thai dance tempo
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

  // Krathongs gently floating in the river from left to right
  for (let i = krathongs.length - 1; i >= 0; i--) {
    const k = krathongs[i];
    k.x += (k.speed || 18) * dt;

    // Loop back from right edge into the left side of the river
    if (k.x > WORLD_WIDTH + 60) {
      k.x = -60;
      k.y = LANDMARKS.riverMinY + Math.random() * (LANDMARKS.riverMaxY - LANDMARKS.riverMinY);
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

  // Walk in festival plaza (Paved areas: Y 560 to 1050)
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
  initAudio();
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

  // Walk player to stone steps at river edge
  myPlayer.targetX = LANDMARKS.pierSteps.x + (Math.random() * 60 - 30);
  myPlayer.targetY = LANDMARKS.pierSteps.y;
  myPlayer.action = 'float';
  myPlayer.isRidingFerris = false;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'float_krathong',
      wish: wish,
      krathong_type: 1
    }));
  }

  playSplash();
  showToast(`✨ คุณกำลังเดินลงท่าน้ำเพื่อปล่อยกระทงลงแม่น้ำ!`);
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
    // Walk to the ground platform first, then board!
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
  initAudio();
  isAudioEnabled = !isAudioEnabled;
  btnAudio.innerText = isAudioEnabled ? '🔊' : '🔇';
  showToast(isAudioEnabled ? '🎵 เปิดเสียงเพลงบรรยากาศ' : '🔇 ปิดเสียง');
});

const btnFullscreen = document.getElementById('btnFullscreen');
btnFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

// Start
connectWebSocket();
requestAnimationFrame(render);
