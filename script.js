/* =========================================================
   MACRO GX — v2
   PART 1 of 3 — imports, state, audio, scene, world
   ========================================================= */

import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

/* ---------- Mobile detect ---------- */
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

/* ---------- State ---------- */
const state = {
  hp: 100, maxHp: 100,
  kills: 0, score: 0, wave: 1,
  ammo: 12, maxAmmo: 12,
  reloading: false, scope: false,
  dead: false, playing: false,
  yVel: 0, onGround: true
};

const settings = {
  keys: {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    reload: 'KeyR', scope: 'ShiftLeft', sprint: 'ShiftRight',
    jump: 'Space', w1: 'Digit1', w2: 'Digit2', w3: 'Digit3'
  },
  sensitivity: 1.0,
  volume: 0.6
};
const savedSet = localStorage.getItem('macroGX.settings');
if (savedSet) { try { Object.assign(settings, JSON.parse(savedSet)); } catch(e){} }
const savedName = localStorage.getItem('macroGX.name');
if (savedName) { const el = document.getElementById('playerName'); if (el) el.value = savedName; }

const WEAPONS = [
  { name: 'PISTOL', maxAmmo: 12, damage: 34, fireRate: 0.28, spread: 0.015, sound: 520 },
  { name: 'RIFLE',  maxAmmo: 30, damage: 26, fireRate: 0.11, spread: 0.028, sound: 620 },
  { name: 'SNIPER', maxAmmo: 5,  damage: 120, fireRate: 1.1, spread: 0.004, sound: 400 }
];
let weaponIndex = 0;

/* ---------- Audio (generated, no files) ---------- */
let audioCtx = null;
function initAudio(){
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
  }
}
function playTone(freq, dur, type, gain){
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq;
  g.gain.value = (gain == null ? 0.15 : gain) * settings.volume;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  o.stop(audioCtx.currentTime + dur);
}
function playGunshot(w){
  playTone(w.sound, 0.06, 'square', 0.2);
  playTone(w.sound * 0.6, 0.09, 'triangle', 0.12);
}
function playHit(){ playTone(880, 0.05, 'square', 0.15); }
function playKill(){ playTone(660, 0.08, 'sine', 0.18); setTimeout(()=>playTone(990, 0.12, 'sine', 0.18), 80); }
function playReloadSfx(){ playTone(300, 0.05, 'square', 0.1); setTimeout(()=>playTone(500, 0.06, 'square', 0.1), 120); }
function playDamage(){ playTone(180, 0.15, 'sawtooth', 0.2); }

/* ---------- Scene ---------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f1e);
scene.fog = new THREE.Fog(0x0a0f1e, 25, 130);

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 500);
camera.position.set(0, 1.7, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

/* ---------- Lights ---------- */
scene.add(new THREE.AmbientLight(0x6688cc, 0.55));
scene.add(new THREE.HemisphereLight(0x22d3ee, 0x0a0f1e, 0.35));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(20, 40, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
scene.add(sun);

/* ---------- Floor + Grid ---------- */
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x1a2438, roughness: 0.9, metalness: 0.1 })
);
floor.rotation.x = -Math.PI/2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(200, 100, 0x22d3ee, 0x1a3550);
grid.material.opacity = 0.15;
grid.material.transparent = true;
grid.position.y = 0.01;
scene.add(grid);

/* ---------- Obstacles / Arena ---------- */
const obstacles = [];
function makeBox(x, y, z, w, h, d, color){
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05 })
  );
  box.position.set(x, y, z);
  box.castShadow = true;
  box.receiveShadow = true;
  box.userData = { half: { x: w/2, y: h/2, z: d/2 }, isWall: true };
  scene.add(box);
  obstacles.push(box);
  return box;
}
makeBox(  0, 2.5, -40, 80, 5, 1, 0x2a3550);
makeBox(  0, 2.5,  40, 80, 5, 1, 0x2a3550);
makeBox(-40, 2.5,   0, 1, 5, 80, 0x2a3550);
makeBox( 40, 2.5,   0, 1, 5, 80, 0x2a3550);
for (let i = 0; i < 18; i++){
  const x = (Math.random() - 0.5) * 60;
  const z = (Math.random() - 0.5) * 60;
  if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
  const w = 1 + Math.random() * 2.2;
  const h = 1 + Math.random() * 1.8;
  const d = 1 + Math.random() * 2.2;
  makeBox(x, h/2, z, w, h, d, 0x35507a);
}

/* ---------- Controls ---------- */
const controls = new PointerLockControls(camera, document.body);

/* ---------- Player Gun ---------- */
const gunGroup = new THREE.Group();
function buildGun(type){
  while (gunGroup.children.length) gunGroup.remove(gunGroup.children[0]);
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.35 });
  const darker = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.85, roughness: 0.25 });

  if (type === 0) {
    gunGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.42), dark));
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.22), darker);
    barrel.position.set(0, 0.03, -0.32); gunGroup.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.1), darker);
    grip.position.set(0, -0.13, 0.14); gunGroup.add(grip);
  } else if (type === 1) {
    gunGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.95), dark));
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), darker);
    barrel.position.set(0, 0.02, -0.72); gunGroup.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.11), darker);
    mag.position.set(0, -0.15, 0); gunGroup.add(mag);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.17, 0.11), darker);
    grip.position.set(0, -0.13, 0.32); gunGroup.add(grip);
  } else {
    gunGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 1.3), dark));
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.9), darker);
    barrel.position.set(0, 0.02, -1.05); gunGroup.add(barrel);
    const scopeM = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), darker);
    scopeM.position.set(0, 0.11, -0.2); gunGroup.add(scopeM);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.1), darker);
    mag.position.set(0, -0.15, 0.1); gunGroup.add(mag);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.17, 0.11), darker);
    grip.position.set(0, -0.13, 0.42); gunGroup.add(grip);
  }
}
buildGun(0);
gunGroup.position.set(0.28, -0.26, -0.55);
gunGroup.rotation.y = -0.05;
camera.add(gunGroup);
scene.add(camera);

/* ---------- Enemy factory ---------- */
const enemies = [];
const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xcc2233, roughness: 0.7, emissive: 0x220008 });
const enemyHeadMat = new THREE.MeshStandardMaterial({ color: 0xddcc99, roughness: 0.8 });
const enemyLimbMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

function makeEnemy(){
  const g = new THREE.Group();

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.35), enemyMaterial);
  torso.position.y = 1.25; torso.castShadow = true; g.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), enemyHeadMat);
  head.position.y = 1.85; head.castShadow = true; g.add(head);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), enemyLimbMat);
  legL.position.set(-0.16, 0.42, 0); legL.castShadow = true; g.add(legL);

  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), enemyLimbMat);
  legR.position.set(0.16, 0.42, 0); legR.castShadow = true; g.add(legR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), enemyMaterial);
  armL.position.set(-0.4, 1.25, 0); armL.castShadow = true; g.add(armL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), enemyMaterial);
  armR.position.set(0.4, 1.25, 0); armR.castShadow = true; g.add(armR);

  g.userData = {
    hp: 3,
    speed: 1.4 + Math.random() * 1.4,
    alive: true,
    parts: [torso, head, legL, legR, armL, armR]
  };
  return g;
}

function spawnEnemy(){
  const e = makeEnemy();
  const a = Math.random() * Math.PI * 2;
  const r = 18 + Math.random() * 20;
  e.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  scene.add(e);
  enemies.push(e);
}

function getEnemyCountForMode(){
  const sel = document.getElementById('gameMode');
  const mode = sel ? sel.value : 'tdm';
  if (mode === '1v1') return 1;
  if (mode === 'tdm') return 4 + state.wave - 1;
  return 8 + state.wave * 2; /* br */
}

/* =========================================================
   PART 2 of 3 — UI, input, settings, movement, shooting
   ========================================================= */

/* ---------- UI refs ---------- */
const el = {
  loading:      document.getElementById('loading'),
  intro:        document.getElementById('intro'),
  menu:         document.getElementById('menu'),
  lobby:        document.getElementById('lobby'),
  settings:     document.getElementById('settings'),
  crosshair:    document.getElementById('crosshair'),
  scope:        document.getElementById('scope'),
  hitMarker:    document.getElementById('hitMarker'),
  dmgFlash:     document.getElementById('dmgFlash'),
  hud:          document.getElementById('hud'),
  hudRight:     document.getElementById('hudRight'),
  hudTop:       document.getElementById('hudTop'),
  killLog:      document.getElementById('killLog'),
  hpText:       document.getElementById('hpText'),
  hpBar:        document.getElementById('hpBar'),
  ammoText:     document.getElementById('ammoText'),
  weaponName:   document.getElementById('weaponName'),
  waveText:     document.getElementById('waveText'),
  killText:     document.getElementById('killText'),
  scoreText:    document.getElementById('scoreText'),
  btnPlay:      document.getElementById('btnPlay'),
  btnSettingsMenu: document.getElementById('btnSettingsMenu'),
  btnInfoMenu:  document.getElementById('btnInfoMenu'),
  btnStart:     document.getElementById('btnStart'),
  btnSettingsLobby: document.getElementById('btnSettingsLobby'),
  btnBackMenu:  document.getElementById('btnBackMenu'),
  btnSettingsClose: document.getElementById('btnSettingsClose'),
  btnResetSettings: document.getElementById('btnResetSettings'),
  playerName:   document.getElementById('playerName'),
  gameMode:     document.getElementById('gameMode'),
  enemyCount:   document.getElementById('enemyCount'),
  roomCode:     document.getElementById('roomCode'),
  sensSlider:   document.getElementById('sensSlider'),
  volSlider:    document.getElementById('volSlider'),
  sensVal:      document.getElementById('sensVal'),
  volVal:       document.getElementById('volVal'),
  mobile:       document.getElementById('mobile')
};

/* ---------- Intro → Menu after 2s ---------- */
setTimeout(() => {
  el.loading.classList.add('hidden');
  el.intro.classList.add('hidden');
  el.menu.classList.remove('hidden');
}, 2000);

/* ---------- Menu buttons ---------- */
el.btnPlay.addEventListener('click', () => {
  el.menu.classList.add('hidden');
  el.lobby.classList.remove('hidden');
  generateRoomCode();
  updateEnemyCountLabel();
});

el.btnInfoMenu.addEventListener('click', () => {
  alert('MACRO GX — v2\n\nControls:\n• WASD to move\n• Mouse to look\n• Click to shoot\n• R to reload\n• Shift (L) to scope\n• Shift (R) to sprint\n• 1/2/3 to switch weapons\n\nRebind keys in Settings.');
});

el.btnBackMenu.addEventListener('click', () => {
  el.lobby.classList.add('hidden');
  el.menu.classList.remove('hidden');
});

el.btnSettingsMenu.addEventListener('click', () => openSettings('menu'));
el.btnSettingsLobby.addEventListener('click', () => openSettings('lobby'));
el.btnSettingsClose.addEventListener('click', closeSettings);
el.btnResetSettings.addEventListener('click', resetSettings);

el.gameMode.addEventListener('change', updateEnemyCountLabel);

function updateEnemyCountLabel(){
  el.enemyCount.textContent = getEnemyCountForMode();
}

function generateRoomCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  el.roomCode.textContent = code;
  localStorage.setItem('macroGX.lastCode', code);
}

/* ---------- Settings open/close ---------- */
let settingsReturnTo = 'menu';
function openSettings(from){
  settingsReturnTo = from || 'menu';
  el.settings.style.display = 'flex';
  refreshSettingsUI();
}
function closeSettings(){
  el.settings.style.display = 'none';
  saveSettings();
}
function refreshSettingsUI(){
  document.querySelectorAll('.keyBtn').forEach(btn => {
    const action = btn.dataset.action;
    btn.textContent = settings.keys[action] || '—';
  });
  el.sensSlider.value = settings.sensitivity;
  el.sensVal.textContent = settings.sensitivity.toFixed(1);
  el.volSlider.value = settings.volume;
  el.volVal.textContent = Math.round(settings.volume * 100) + '%';
}
function saveSettings(){
  localStorage.setItem('macroGX.settings', JSON.stringify(settings));
}
function resetSettings(){
  settings.keys = {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    reload: 'KeyR', scope: 'ShiftLeft', sprint: 'ShiftRight',
    jump: 'Space', w1: 'Digit1', w2: 'Digit2', w3: 'Digit3'
  };
  settings.sensitivity = 1.0;
  settings.volume = 0.6;
  saveSettings();
  refreshSettingsUI();
}

/* ---------- Key rebinding ---------- */
let listeningKey = null;
document.querySelectorAll('.keyBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (listeningKey) listeningKey.classList.remove('listening');
    listeningKey = btn;
    btn.classList.add('listening');
    btn.textContent = '...';
  });
});
document.addEventListener('keydown', e => {
  if (!listeningKey) return;
  e.preventDefault();
  const action = listeningKey.dataset.action;
  settings.keys[action] = e.code;
  listeningKey.textContent = e.code;
  listeningKey.classList.remove('listening');
  listeningKey = null;
  saveSettings();
}, true);

/* ---------- Sliders ---------- */
el.sensSlider.addEventListener('input', () => {
  settings.sensitivity = parseFloat(el.sensSlider.value);
  el.sensVal.textContent = settings.sensitivity.toFixed(1);
  saveSettings();
});
el.volSlider.addEventListener('input', () => {
  settings.volume = parseFloat(el.volSlider.value);
  el.volVal.textContent = Math.round(settings.volume * 100) + '%';
  saveSettings();
});

/* ---------- Input keys ---------- */
const keys = {};
document.addEventListener('keydown', e => { keys[e.code] = true; handleHotkeys(e); });
document.addEventListener('keyup',   e => { keys[e.code] = false; });

function actionPressed(action){
  return !!keys[settings.keys[action]];
}

function handleHotkeys(e){
  if (!state.playing) return;
  if (e.code === settings.keys.reload) reload();
  if (e.code === settings.keys.w1) switchWeapon(0);
  if (e.code === settings.keys.w2) switchWeapon(1);
  if (e.code === settings.keys.w3) switchWeapon(2);
}

/* ---------- Weapon switching ---------- */
function switchWeapon(i){
  weaponIndex = i;
  state.maxAmmo = WEAPONS[i].maxAmmo;
  state.ammo = WEAPONS[i].maxAmmo;
  state.reloading = false;
  buildGun(i);
  updateAmmoUI();
}

function updateAmmoUI(){
  el.ammoText.textContent = state.ammo + ' / ' + WEAPONS[weaponIndex].maxAmmo;
  el.weaponName.textContent = WEAPONS[weaponIndex].name;
}

/* ---------- Reload ---------- */
function reload(){
  if (state.reloading) return;
  if (state.ammo === WEAPONS[weaponIndex].maxAmmo) return;
  state.reloading = true;
  playReloadSfx();
  el.ammoText.textContent = 'RELOADING...';
  setTimeout(() => {
    state.ammo = WEAPONS[weaponIndex].maxAmmo;
    state.reloading = false;
    updateAmmoUI();
  }, 1200);
}

/* ---------- Shooting ---------- */
const raycaster = new THREE.Raycaster();
let lastShot = 0;

function shoot(){
  if (state.dead || state.reloading || !state.playing) return;
  const now = performance.now() / 1000;
  if (now - lastShot < WEAPONS[weaponIndex].fireRate) return;
  if (state.ammo <= 0) { reload(); return; }
  lastShot = now;
  state.ammo--;
  updateAmmoUI();
  playGunshot(WEAPONS[weaponIndex]);

  /* muzzle flash */
  const flash = new THREE.PointLight(0xffaa33, 4, 6);
  flash.position.set(0.28, -0.2, -1);
  camera.add(flash);
  setTimeout(() => camera.remove(flash), 60);

  /* recoil */
  gunGroup.position.z = -0.42;
  gunGroup.rotation.x = 0.08;

  /* raycast */
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const targets = [];
  enemies.forEach(e => e.children.forEach(p => targets.push(p)));
  const hits = raycaster.intersectObjects(targets.concat(obstacles), false);
  if (!hits.length) return;

  const hitObj = hits[0].object;
  const enemy = hitObj.parent;
  if (enemy && enemy.userData && enemy.userData.alive){
    const isHead = hitObj.geometry.parameters.height < 0.45;
    const dmg = isHead ? 10 : 1;
    enemy.userData.hp -= dmg;
    showHitMarker();
    playHit();
    if (enemy.userData.hp <= 0){
      killEnemy(enemy);
    }
  }
}

function showHitMarker(){
  el.hitMarker.classList.remove('on');
  void el.hitMarker.offsetWidth;
  el.hitMarker.classList.add('on');
}

function killEnemy(enemy){
  enemy.userData.alive = false;
  scene.remove(enemy);
  const idx = enemies.indexOf(enemy);
  if (idx > -1) enemies.splice(idx, 1);
  state.kills++;
  state.score += 100;
  playKill();
  addKillLog('ENEMY DOWN +100');
  updateHUD();
  setTimeout(() => {
    if (state.playing) spawnEnemy();
  }, 1500);
}

function addKillLog(text){
  const line = document.createElement('div');
  line.className = 'killLine';
  line.textContent = text;
  el.killLog.appendChild(line);
  setTimeout(() => line.remove(), 2200);
}

function updateHUD(){
  el.killText.textContent = state.kills;
  el.scoreText.textContent = state.score;
  el.waveText.textContent = state.wave;
  const pct = (state.hp / state.maxHp) * 100;
  el.hpBar.style.width = pct + '%';
  el.hpBar.classList.toggle('low', pct < 35);
  el.hpText.textContent = state.hp;
}

/* ---------- Damage to player ---------- */
function playerDamage(amount){
  if (state.dead) return;
  state.hp -= amount;
  playDamage();
  el.dmgFlash.classList.add('on');
  setTimeout(() => el.dmgFlash.classList.remove('on'), 130);
  if (state.hp <= 0){
    state.hp = 0;
    state.dead = true;
    gameOver();
  }
  updateHUD();
}

function gameOver(){
  state.playing = false;
  if (controls.isLocked) controls.unlock();
  const over = document.createElement('div');
  over.className = 'screen';
  over.innerHTML = `
    <h2 style="font-size:44px;letter-spacing:10px;color:#ef4444;text-shadow:0 0 24px #ef4444;">GAME OVER</h2>
    <p style="margin-top:20px;letter-spacing:3px;">KILLS: ${state.kills} · SCORE: ${state.score} · WAVE: ${state.wave}</p>
    <div style="margin-top:30px;">
      <button class="btn green" id="btnRespawn">▶ PLAY AGAIN</button>
      <button class="btn" id="btnMenuReturn">← MAIN MENU</button>
    </div>
  `;
  document.body.appendChild(over);
  document.getElementById('btnRespawn').onclick = () => { over.remove(); respawn(); };
  document.getElementById('btnMenuReturn').onclick = () => {
    over.remove();
    document.body.querySelectorAll('.screen').forEach(s => {
      if (s.id === 'menu') s.classList.remove('hidden');
      else s.classList.add('hidden');
    });
    el.hud.classList.remove('on');
    el.hudRight.classList.remove('on');
    el.hudTop.classList.remove('on');
    el.killLog.classList.remove('on');
    el.crosshair.classList.remove('on');
  };
}

function respawn(){
  state.hp = state.maxHp;
  state.dead = false;
  state.kills = 0;
  state.score = 0;
  state.wave = 1;
  enemies.forEach(e => scene.remove(e));
  enemies.length = 0;
  startMatch();
}

/* ---------- Start match ---------- */
function startMatch(){
  state.playing = true;
  state.hp = state.maxHp;
  state.ammo = WEAPONS[weaponIndex].maxAmmo;
  camera.position.set(0, 1.7, 5);

  const count = getEnemyCountForMode();
  for (let i = 0; i < count; i++) spawnEnemy();

  el.hud.classList.add('on');
  el.hudRight.classList.add('on');
  el.hudTop.classList.add('on');
  el.killLog.classList.add('on');
  el.crosshair.classList.add('on');

  updateHUD();
  updateAmmoUI();

  if (isMobile) el.mobile.classList.add('on');
  else controls.lock();

  initAudio();
}

el.btnStart.addEventListener('click', () => {
  const name = (el.playerName.value || 'PLAYER').toUpperCase().slice(0, 14);
  localStorage.setItem('macroGX.name', name);
  el.lobby.classList.add('hidden');
  startMatch();
});

controls.addEventListener('unlock', () => {
  if (state.playing && !state.dead && !isMobile){
    el.hud.classList.remove('on');
    el.hudRight.classList.remove('on');
    el.hudTop.classList.remove('on');
    el.killLog.classList.remove('on');
    el.crosshair.classList.remove('on');
  }
});
controls.addEventListener('lock', () => {
  if (state.playing && !state.dead){
    el.hud.classList.add('on');
    el.hudRight.classList.add('on');
    el.hudTop.classList.add('on');
    el.killLog.classList.add('on');
    el.crosshair.classList.add('on');
  }
});

/* ---------- Mouse: shoot + scope ---------- */
document.addEventListener('mousedown', e => {
  if (!state.playing || state.dead) return;
  if (controls.isLocked) shoot();
});
document.addEventListener('keydown', e => {
  if (e.code === settings.keys.scope && state.playing){
    state.scope = true;
    camera.fov = 45;
    camera.updateProjectionMatrix();
    el.scope.classList.add('on');
  }
});
document.addEventListener('keyup', e => {
  if (e.code === settings.keys.scope){
    state.scope = false;
    camera.fov = 75;
    camera.updateProjectionMatrix();
    el.scope.classList.remove('on');
  }
});

/* ---------- Movement ---------- */
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let walkPhase = 0;

function updateMovement(dt){
  if (!state.playing || state.dead) return;

  const sprinting = actionPressed('sprint');
  const speed = sprinting ? 11 : 7;

  velocity.x -= velocity.x * 9 * dt;
  velocity.z -= velocity.z * 9 * dt;

  direction.z = Number(actionPressed('forward')) - Number(actionPressed('back'));
  direction.x = Number(actionPressed('right'))   - Number(actionPressed('left'));
  direction.normalize();

  if (direction.z !== 0) velocity.z -= direction.z * speed * dt;
  if (direction.x !== 0) velocity.x -= direction.x * speed * dt;

  controls.moveRight(-velocity.x * dt);
  controls.moveForward(-velocity.z * dt);

  /* Jump */
  if (actionPressed('jump') && state.onGround){
    state.yVel = 6.5;
    state.onGround = false;
  }
  state.yVel -= 18 * dt;
  camera.position.y += state.yVel * dt;
  if (camera.position.y < 1.7){
    camera.position.y = 1.7;
    state.yVel = 0;
    state.onGround = true;
  }

  /* Collision with obstacles */
  const p = camera.position;
  const radius = 0.4;
  for (const o of obstacles){
    const dx = p.x - o.position.x;
    const dz = p.z - o.position.z;
    const hx = o.userData.half.x + radius;
    const hz = o.userData.half.z + radius;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz){
      const ox = hx - Math.abs(dx);
      const oz = hz - Math.abs(dz);
      if (ox < oz) p.x += Math.sign(dx || 1) * ox;
      else p.z += Math.sign(dz || 1) * oz;
    }
  }

  /* Keep inside arena */
  p.x = Math.max(-39, Math.min(39, p.x));
  p.z = Math.max(-39, Math.min(39, p.z));

  /* Gun bob */
  const moving = Math.abs(velocity.x) + Math.abs(velocity.z) > 1;
  if (moving){
    walkPhase += dt * (sprinting ? 14 : 9);
    gunGroup.position.x = 0.28 + Math.sin(walkPhase) * 0.012;
    gunGroup.position.y = -0.26 + Math.abs(Math.cos(walkPhase)) * 0.012;
  } else {
    gunGroup.position.x += (0.28 - gunGroup.position.x) * 8 * dt;
    gunGroup.position.y += (-0.26 - gunGroup.position.y) * 8 * dt;
  }
  gunGroup.position.z += (-0.55 - gunGroup.position.z) * 8 * dt;
  gunGroup.rotation.x += (0 - gunGroup.rotation.x) * 8 * dt;
}

/* ---------- Enemy AI ---------- */
function updateEnemies(dt){
  if (!state.playing || state.dead) return;
  for (const e of enemies){
    if (!e.userData.alive) continue;
    const dir = new THREE.Vector3().subVectors(camera.position, e.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist > 2.2){
      dir.normalize();
      e.position.addScaledVector(dir, e.userData.speed * dt);
    } else {
      /* in range — attack */
      if (!e.userData.atkCd || performance.now() - e.userData.atkCd > 1100){
        e.userData.atkCd = performance.now();
        playerDamage(6);
      }
    }
    e.lookAt(camera.position.x, e.position.y, camera.position.z);
  }
}

/* =========================================================
   PART 3 of 3 — waves, mobile controls, animate loop, resize
   ========================================================= */

/* ---------- Wave system ---------- */
let waveTimer = 0;
function updateWaves(dt){
  if (!state.playing || state.dead) return;
  waveTimer += dt;
  if (waveTimer > 30){
    waveTimer = 0;
    state.wave++;
    updateHUD();
    addKillLog('WAVE ' + state.wave);
    const target = getEnemyCountForMode();
    while (enemies.length < target) spawnEnemy();
  }
}

/* ---------- Mobile controls ---------- */
const mobileState = { moveX: 0, moveY: 0 };

if (isMobile && el.mobile){
  /* Joystick */
  const joy = document.getElementById('mJoy');
  const knob = document.getElementById('mKnob');
  let joyId = null, joyStart = { x: 0, y: 0 };

  joy.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyId = t.identifier;
    const r = joy.getBoundingClientRect();
    joyStart.x = r.left + r.width / 2;
    joyStart.y = r.top + r.height / 2;
  }, { passive: false });

  document.addEventListener('touchmove', e => {
    if (joyId === null) return;
    for (const t of e.changedTouches){
      if (t.identifier === joyId){
        const dx = t.clientX - joyStart.x;
        const dy = t.clientY - joyStart.y;
        const dist = Math.min(60, Math.hypot(dx, dy));
        const ang = Math.atan2(dy, dx);
        knob.style.transform = 'translate(calc(-50% + ' + (Math.cos(ang) * dist) + 'px), calc(-50% + ' + (Math.sin(ang) * dist) + 'px))';
        mobileState.moveX = Math.cos(ang) * (dist / 60);
        mobileState.moveY = Math.sin(ang) * (dist / 60);
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', e => {
    for (const t of e.changedTouches){
      if (t.identifier === joyId){
        joyId = null;
        knob.style.transform = 'translate(-50%, -50%)';
        mobileState.moveX = 0;
        mobileState.moveY = 0;
      }
    }
  });

  /* Look area (right side of screen) */
  let lookId = null, lookLast = { x: 0, y: 0 };
  document.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    if (t.clientX < innerWidth * 0.4) return;
    if (e.target.closest('#mFire, #mReload, #mScope')) return;
    lookId = t.identifier;
    lookLast.x = t.clientX;
    lookLast.y = t.clientY;
  }, { passive: false });

  document.addEventListener('touchmove', e => {
    if (lookId === null) return;
    for (const t of e.changedTouches){
      if (t.identifier === lookId){
        const dx = t.clientX - lookLast.x;
        const dy = t.clientY - lookLast.y;
        lookLast.x = t.clientX;
        lookLast.y = t.clientY;
        const yaw   = camera.rotation.y - dx * 0.005 * settings.sensitivity;
        const pitch = Math.max(-1.4, Math.min(1.4, camera.rotation.x - dy * 0.005 * settings.sensitivity));
        camera.rotation.order = 'YXZ';
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', e => {
    for (const t of e.changedTouches){
      if (t.identifier === lookId) lookId = null;
    }
  });

  /* Fire button */
  const fireBtn = document.getElementById('mFire');
  let fireHeld = false;
  fireBtn.addEventListener('touchstart', e => { e.preventDefault(); fireHeld = true; shoot(); }, { passive: false });
  fireBtn.addEventListener('touchend',   e => { e.preventDefault(); fireHeld = false; }, { passive: false });

  /* Reload button */
  document.getElementById('mReload').addEventListener('touchstart', e => { e.preventDefault(); reload(); }, { passive: false });

  /* Scope button (toggle) */
  document.getElementById('mScope').addEventListener('touchstart', e => {
    e.preventDefault();
    state.scope = !state.scope;
    camera.fov = state.scope ? 45 : 75;
    camera.updateProjectionMatrix();
    el.scope.classList.toggle('on', state.scope);
  }, { passive: false });
}

/* Mobile-fire autofire */
function mobileFireTick(){
  if (isMobile && state.playing && !state.dead){
    const fireBtn = document.getElementById('mFire');
    if (fireBtn && fireBtn.dataset.held === '1') shoot();
  }
}

/* Mobile look: continuous fire while touching fire button */
if (isMobile){
  const fireBtn = document.getElementById('mFire');
  fireBtn.addEventListener('touchstart', () => { fireBtn.dataset.held = '1'; });
  fireBtn.addEventListener('touchend',   () => { fireBtn.dataset.held = '0'; });
}

/* ---------- Desktop pointer-lock hint ---------- */
document.addEventListener('click', () => {
  if (!isMobile && state.playing && !state.dead && !controls.isLocked) controls.lock();
});

/* ---------- Resize ---------- */
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------- Main loop ---------- */
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state.playing){
    updateMovement(dt);
    updateEnemies(dt);
    updateWaves(dt);
    mobileFireTick();
  }

  renderer.render(scene, camera);
}
animate();

/* ---------- Auto start intro flow after load ---------- */
window.addEventListener('load', () => {
  el.loading.classList.add('hidden');
  refreshSettingsUI();
  updateAmmoUI();
  updateHUD();
});
