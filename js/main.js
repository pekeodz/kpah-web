// Khởi động: tải dữ liệu, màn hình tiêu đề, tạo nhân vật, vòng lặp, điều khiển
import { G, loadAll, CLASSES } from './data.js';
import { CONFIG } from './config.js';
import { W, newPlayer, recalc, enterMap, update, draw, screenToWorld, clickWorld, attackNearest, useSkill, usePotion, lookOf } from './game.js';
import { UI, SAVE_KEY } from './ui.js';
import { drawChar } from './render.js';
import { Cloud } from './cloud.js';

const $ = (s) => document.querySelector(s);
const cv = $('#game');
const ctx = cv.getContext('2d');

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = innerWidth, h = innerHeight;
  let s = CONFIG.SCALE || Math.max(2, Math.min(4, Math.round(Math.min(w / 420, h / 300))));
  W.scale = s; W.dpr = dpr;
  W.vw = Math.ceil(w / s); W.vh = Math.ceil(h / s);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
}
addEventListener('resize', resize); resize();
window.KPAH = { W, enterMap, UI }; // tiện cho gỡ lỗi trong console

// ---------- vòng lặp ----------
function frame(now) {
  const dt = Math.min(50, now - (W.last || now)); W.last = now;
  update(dt);
  ctx.setTransform(W.scale * W.dpr, 0, 0, W.scale * W.dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  UI.tickCooldowns();
  requestAnimationFrame(frame);
}

// ---------- điều khiển ----------
const KEYMAP = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, w: 1, a: 1, s: 1, d: 1 };
addEventListener('keydown', (e) => {
  if (!W.P || e.target.tagName === 'INPUT') return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (KEYMAP[k]) { W.keys[k] = true; e.preventDefault(); return; }
  if (k === ' ') { attackNearest(); e.preventDefault(); }
  else if (k >= '1' && k <= '5') { const sk = W.P.slots[+k - 1]; if (sk >= 0) useSkill(sk); }
  else if (k === 'q') usePotion('hp');
  else if (k === 'e') usePotion('mp');
  else if (k === 'z') UI.setAuto(!W.auto);
  else if (k === 'Enter') { if (!$('#dialog').classList.contains('hidden')) $('#dlg-opts button')?.click(); else if (W.nearNpc) UI.talk(W.nearNpc); }
  else if (k === 'i') UI.win === 'bag' ? UI.close() : UI.open('bag');
  else if (k === 'c') UI.win === 'char' ? UI.close() : UI.open('char');
  else if (k === 'k') UI.win === 'skill' ? UI.close() : UI.open('skill');
  else if (k === 'm') UI.win === 'map' ? UI.close() : UI.open('map');
  else if (k === 'Escape') { if (UI.win) UI.close(); else UI.open('sys'); }
});
addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; W.keys[k] = false; });
addEventListener('blur', () => { W.keys = {}; });
cv.addEventListener('pointerdown', (e) => {
  if (!W.P) return;
  if (UI.win) UI.close();
  const p = screenToWorld(e.clientX, e.clientY);
  clickWorld(p.x, p.y);
});
// joystick cảm ứng
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
const joy = $('#joystick'), stick = $('#stick');
let joyId = null;
joy.addEventListener('pointerdown', (e) => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); moveJoy(e); });
joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) moveJoy(e); });
const endJoy = () => { joyId = null; W.joy.x = W.joy.y = 0; stick.style.left = stick.style.top = '35px'; };
joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
function moveJoy(e) {
  const r = joy.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const L = Math.hypot(dx, dy), max = 40;
  if (L > max) { dx = dx / L * max; dy = dy / L * max; }
  stick.style.left = (35 + dx) + 'px'; stick.style.top = (35 + dy) + 'px';
  W.joy.x = Math.abs(dx) > 8 ? dx / max : 0; W.joy.y = Math.abs(dy) > 8 ? dy / max : 0;
}
$('#btn-attack').addEventListener('pointerdown', (e) => { e.preventDefault(); attackNearest(); });

// ---------- vào game ----------
function startGame(P) {
  W.P = P;
  P.bagMax = P.bagMax || 42; P.slots = P.slots || [0, 1, 2, 3, -1]; P.potions = P.potions || {};
  $('#screen-title').classList.add('hidden'); $('#screen-create').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  UI.init();
  recalc();
  enterMap(G.data.maps[P.map] ? P.map : 0, P.x, P.y);
  UI.refreshHud();
  UI.save(true);
  UI.log(`Chào mừng ${P.name} đến với Khí Phách Anh Hùng!`, '#ffe27a');
  if (P.intro) UI.log('Mẹo: bấm vào quái để đánh, nhấn Z (hoặc nút AUTO) để tự động luyện cấp.');
}
function loadLocal() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } }

// ---------- màn hình tạo nhân vật ----------
const cr = { cls: 0, gender: 1, head: 0 };
const MALE_HEADS = [0, 4, 6, 10, 12, 16, 18, 22, 24, 28, 30, 32, 34, 38, 40, 42, 46, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70],
  FEMALE_HEADS = [1, 2, 3, 5, 7, 8, 9, 11, 13, 19, 21, 23, 25, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69];
function headList() { return cr.gender === 1 ? MALE_HEADS : FEMALE_HEADS; }
function drawCreate() {
  const c = $('#create-cv'), x = c.getContext('2d');
  const P = newPlayer('x', cr.cls, cr.gender, cr.head);
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 96, 96); x.imageSmoothingEnabled = false;
  x.fillStyle = '#2d4a22'; x.fillRect(0, 0, 96, 96);
  x.setTransform(2, 0, 0, 2, 0, 0);
  const t = performance.now();
  const dir = Math.floor(t / 1800) % 4;
  drawChar(x, lookOf(P), 24, 38, [0, 3, 1, 2][dir], [1, 0, 2, 0][Math.floor(t / 150) % 4]);
  if (!$('#screen-create').classList.contains('hidden')) requestAnimationFrame(drawCreate);
}
function showCreate() {
  $('#screen-title').classList.add('hidden'); $('#screen-create').classList.remove('hidden');
  const box = $('#cr-class'); box.innerHTML = '';
  CLASSES.forEach((c, i) => {
    const b = document.createElement('button'); b.textContent = `${c.name} · ${c.he}`; b.className = i === cr.cls ? 'on' : '';
    b.onclick = () => { cr.cls = i; showCreate(); }; box.append(b);
  });
  $('#cr-desc').textContent = CLASSES[cr.cls].desc;
  document.querySelectorAll('#cr-gender button').forEach(b => {
    b.className = +b.dataset.g === cr.gender ? 'on' : '';
    b.onclick = () => { cr.gender = +b.dataset.g; cr.head = headList()[0]; showCreate(); };
  });
  drawCreate();
}
$('#head-prev').onclick = () => { const L = headList(); cr.head = L[(L.indexOf(cr.head) - 1 + L.length) % L.length]; };
$('#head-next').onclick = () => { const L = headList(); cr.head = L[(L.indexOf(cr.head) + 1) % L.length]; };
$('#cr-back').onclick = () => { $('#screen-create').classList.add('hidden'); $('#screen-title').classList.remove('hidden'); };
$('#cr-ok').onclick = () => {
  const name = $('#cr-name').value.trim();
  if (name.length < 2) { $('#cr-name').focus(); $('#cr-name').placeholder = 'Tên cần ít nhất 2 ký tự'; return; }
  const old = loadLocal();
  if (old && !confirm(`Nhân vật cũ "${old.name}" (cấp ${old.level}) sẽ bị ghi đè. Tiếp tục?`)) return;
  startGame(newPlayer(name, cr.cls, cr.gender, cr.head));
};

// ---------- boot ----------
(async function boot() {
  await loadAll(p => { $('#load-pct').textContent = Math.round(p * 100) + '%'; });
  $('#loading').classList.add('hidden'); $('#title-menu').classList.remove('hidden');
  const sv = loadLocal();
  if (sv) $('#btn-continue').textContent = `Tiếp tục: ${sv.name} (cấp ${sv.level})`; else $('#btn-continue').classList.add('hidden');
  if (!Cloud.enabled()) $('#btn-cloud-load').classList.add('hidden');
  $('#btn-continue').onclick = () => startGame(loadLocal());
  $('#btn-new').onclick = showCreate;
  $('#btn-cloud-load').onclick = async () => {
    try { const d = await Cloud.load(); if (!d) return alert('Chưa có bản lưu trên đám mây'); startGame(d); }
    catch (e) { alert('Lỗi Firebase: ' + e.message); }
  };
  $('#btn-import').onclick = () => $('#file-import').click();
  $('#file-import').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); if (!d.name || d.cls == null) throw new Error('File không hợp lệ'); startGame(d); }
    catch (err) { alert(err.message); }
  };
  addEventListener('beforeunload', () => W.P && UI.save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden && W.P) UI.save(true); });
  requestAnimationFrame(frame);
})();
