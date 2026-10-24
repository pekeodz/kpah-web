// Lõi game: thế giới, nhân vật, quái, chiến đấu, điều khiển
import { G, img, CLASSES, SKILL_FX, BUFF_SKILLS, NPC_NAMES, NPC_LINES, NPC_LOOKS } from './data.js';
import { CONFIG } from './config.js';
import { drawChar, drawMob, mapCanvas, drawTop } from './render.js';
import * as St from './stats.js';

export const W = {
  P: null, S: null, map: null, mobs: [], npcs: [], drops: [], fx: [], texts: [], trees: [],
  cam: { x: 0, y: 0 }, vw: 320, vh: 240, scale: 2, dpr: 1,
  keys: {}, joy: { x: 0, y: 0 }, moveTo: null, target: null, talkTarget: null,
  auto: false, paused: false, t: 0, last: 0, lastSave: 0, onWp: true, lastCombat: 0,
  player: { x: 0, y: 0, dir: 0, frame: 0, walkT: 0, atkT: 0, castType: 0 },
  ui: null, // gắn từ ui.js
};
const HP_IDS = [1, 2, 3, 21, 22, 93, 94], MP_IDS = [4, 5, 6, 23, 24, 95, 96];

// ================== Nhân vật ==================
export function newPlayer(name, cls, gender, head) {
  const pts = [[25, 20, 10, 25, 10], [30, 20, 10, 20, 10], [10, 25, 35, 10, 10], [20, 30, 10, 20, 10], [20, 30, 15, 15, 10]][cls];
  const P = {
    v: 1, name, cls, gender, head, level: 1, exp: 0,
    pts: { str: pts[0], agi: pts[1], spi: pts[2], hea: pts[3], luck: pts[4], base: 0, skill: 0 },
    hp: -1, mp: -1, xu: CONFIG.START_XU,
    skills: cls === 2 ? [1, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, -1, -1, -1, -1] : [1, 0, 0, 0, 0, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    body: {}, bag: [], potions: { 1: 10, 4: 10 }, bagMax: 42,
    map: 105, x: 184, y: 280, village: 0, intro: false, quickHp: 1, quickMp: 4,
    slots: [0, 1, 2, 3, -1], kills: 0, created: Date.now(),
  };
  const ao = gender === 1 ? 2 : 1, quan = gender === 1 ? 28 : 27;
  P.body[0] = St.newEquip(ao, cls);
  P.body[1] = St.newEquip(quan, cls);
  P.body[3] = St.newEquip(CLASSES[cls].weapon, cls);
  return P;
}
export function lookOf(P) {
  const b = P.body;
  const it = (s) => b[s] ? G.data.items[b[s].id] : null;
  return {
    head: P.head, body: it(0) ? it(0).st : 0, leg: it(1) ? it(1).st : 0,
    hat: it(2) ? it(2).st : -1, weapon: b[3] ? b[3].id : null,
  };
}
export function recalc() {
  const P = W.P;
  W.S = St.calcStats(P);
  if (P.hp < 0 || P.hp > W.S.hpMax) P.hp = P.hp < 0 ? W.S.hpMax : W.S.hpMax;
  if (P.mp < 0 || P.mp > W.S.mpMax) P.mp = P.mp < 0 ? W.S.mpMax : W.S.mpMax;
  W.look = lookOf(P);
  W.ui && W.ui.refreshHud();
}

// ================== Bản đồ ==================
function tileType(map, i) {
  const k = map.tiles[i];
  if (k === 255 || k < 0) return 0;
  return G.data.tileTypes[map.ts][k] || 0;
}
export function blocked(x, y) {
  const m = W.map;
  if (x < 0 || y < 0 || x >= m.w * 16 || y >= m.h * 16) return true;
  return (tileType(m, (y >> 4) * m.w + (x >> 4)) & 2) === 2;
}
function wpAt(x, y) {
  const tx = x >> 4, ty = y >> 4;
  return W.map.wps.find(w => w[3] === tx && w[4] === ty);
}
function nearestFree(x, y) {
  if (!blocked(x, y)) return [x, y];
  for (let r = 1; r < 30; r++) {
    for (let a = 0; a < 16; a++) {
      const nx = x + Math.round(Math.cos(a / 16 * Math.PI * 2) * r * 8), ny = y + Math.round(Math.sin(a / 16 * Math.PI * 2) * r * 8);
      if (!blocked(nx, ny) && !wpAt(nx, ny)) return [nx, ny];
    }
  }
  return [x, y];
}

export function enterMap(id, x, y) {
  const map = G.data.maps[id];
  if (!map) { W.ui && W.ui.toast('Không thể chuyển bản đồ'); return; }
  const prev = W.map;
  if (prev && !prev.offline && map.offline) W.P.back = { map: prev.id, x: W.player.x, y: W.player.y };
  W.map = map; W.P.map = id;
  mapCanvas(map);
  if (x == null || x <= 0) { x = Math.floor(map.w / 2) * 16 + 8; y = Math.floor(map.h / 2) * 16 + 8; }
  [x, y] = nearestFree(x, y);
  W.player.x = x; W.player.y = y; W.P.x = x; W.P.y = y;
  W.onWp = !!wpAt(x, y);
  W.moveTo = null; W.target = null; W.talkTarget = null;
  W.drops = []; W.fx = []; W.texts = [];
  // quái
  W.mobs = map.mobs.map((m, i) => {
    const t = G.data.mobs[m[0]];
    return t && makeMob(t, m[1], m[2], i);
  }).filter(Boolean);
  // NPC
  W.npcs = [];
  for (const [idx, tx, ty] of map.npcs) {
    const look = NPC_LOOKS[(idx * 5 + 3) % NPC_LOOKS.length];
    W.npcs.push({ kind: idx, name: NPC_NAMES[idx] || 'NPC', x: tx * 16 + 8, y: ty * 16 + 14, dir: 0,
      look: { head: [17, 20, 22, 14, 18, 15, 12, 24][idx % 8], body: G.data.items[look[0]].st, leg: G.data.items[look[1]].st, hat: G.data.items[look[2]].st, weapon: null } });
  }
  for (const [aid, ax, ay] of map.actors) {
    const a = G.data.npcActor[aid]; if (!a) continue;
    const b = a.body.map(i => G.data.items[i]);
    W.npcs.push({ kind: -1 - aid, name: actorName(a.name), x: ax, y: ay, dir: 0,
      look: { head: a.head, body: b[0] ? b[0].st : 0, leg: b[1] ? b[1].st : 0, hat: b[2] ? b[2].st : -1, weapon: null } });
  }
  // cây
  W.trees = map.trees.filter(t => G.data.trees[t[0]]).map(([id, tx, ty]) => {
    const [dx, dy] = G.data.trees[id];
    return { id, x: tx * 16 + dx, y: ty * 16 + dy, sy: ty * 16 + 10 };
  });
  W.ui && W.ui.onMapChange();
  if (map.id === 105 && !W.P.intro) setTimeout(() => W.ui && W.ui.intro(), 400);
}
function actorName(n) {
  const m = { 'tien nu': 'Tiên nữ', 'tong tieu dau': 'Tổng tiêu đầu', 'dau truong': 'Đấu trường', 'thohopthanhcaocap': 'Thợ hợp thành cao cấp',
    'thohopthanhsocap': 'Thợ hợp thành sơ cấp', 'tong quan': 'Tổng quản', 'tho ren than bi': 'Thợ rèn thần bí', 'phat lo': 'Phát lộ',
    'thay ngu hanh': 'Thầy ngũ hành', 'market': 'Chợ', 'nguyet lao': 'Nguyệt lão', 'ky nang bang': 'Kỹ năng bang', 'le quan': 'Lễ quan',
    'tho san': 'Thợ săn', 'hao duyen': 'Hảo duyên', 'tran thong linh': 'Trần thống lĩnh', 'huu thong linh': 'Hữu thống lĩnh',
    'ta thong linh': 'Tả thống lĩnh', 'ta pho thong': 'Tả phó thống', 'xa phu': 'Xa phu', 'hoa tieu': 'Hoa tiêu' };
  return m[n] || n;
}
function makeMob(t, x, y, i) {
  return { t, sx: x, sy: y, x, y, hp: t.hp, dir: 0, phase: i % 7, moving: false, wanderT: Math.random() * 3000,
    tx: x, ty: y, aggro: false, atkCD: 1000 + Math.random() * 1000, attackT: 0, hurt: 0, dead: false, deadT: 0, respawn: 0,
    ore: t.id >= 85 && t.id <= 89, noHit: t.id >= 36 && t.id <= 46, passive: (t.id >= 85 && t.id <= 89) || (t.id >= 36 && t.id <= 46) };
}

// ================== Vòng lặp ==================
export function update(dt) {
  W.t += dt;
  if (!W.P || W.paused) return;
  updatePlayer(dt);
  updateMobs(dt);
  updateDrops(dt);
  for (const f of W.fx) f.t += dt;
  W.fx = W.fx.filter(f => f.t < f.dur);
  for (const tx of W.texts) { tx.t += dt; tx.y -= dt * 0.025; }
  W.texts = W.texts.filter(t => t.t < 1100);
  for (const k in W.cds) W.cds[k] = Math.max(0, W.cds[k] - dt);
  // buff
  const B = W.P._buffs;
  if (B) for (const k in B) { B[k].t -= dt; if (B[k].t <= 0) { delete B[k]; recalc(); } }
  // hồi phục khi ngoài chiến đấu
  W.regenT = (W.regenT || 0) + dt;
  if (W.regenT > 2000) {
    W.regenT = 0;
    if (!W.dead && W.t - W.lastCombat > 5000) {
      const P = W.P, S = W.S, mul = W.map.mobs.length === 0 ? 5 : 1;
      P.hp = Math.min(S.hpMax, P.hp + Math.ceil(S.hpMax * 0.01 * mul));
      P.mp = Math.min(S.mpMax, P.mp + Math.ceil(S.mpMax * 0.01 * mul));
      W.ui.refreshBars();
    }
  }
  if (W.t - W.lastSave > CONFIG.AUTOSAVE_SEC * 1000) { W.lastSave = W.t; W.ui.save(true); }
}

function updatePlayer(dt) {
  const p = W.player, P = W.P;
  if (W.dead) return;
  if (p.atkT > 0) p.atkT -= dt;
  let mx = 0, my = 0;
  const k = W.keys;
  if (k.ArrowLeft || k.a) mx -= 1; if (k.ArrowRight || k.d) mx += 1;
  if (k.ArrowUp || k.w) my -= 1; if (k.ArrowDown || k.s) my += 1;
  if (W.joy.x || W.joy.y) { mx = W.joy.x; my = W.joy.y; }
  if (mx || my) { W.moveTo = null; W.talkTarget = null; if (!W.auto) W.chase = null; }
  // tự động / đuổi mục tiêu
  if (!mx && !my) {
    const goal = goalPoint();
    if (goal) {
      const st = steer(goal);
      if (st === null) { W.path = null; goal.done && goal.done(); }
      else if (st === 'fail') {
        W.path = null;
        if (W.target) { W.target.unreach = W.t + 15000; W.target = null; W.chase = null; }
        if (W.talkTarget) { W.talkTarget = null; }
        W.moveTo = null;
      } else { mx = st[0]; my = st[1]; }
    } else W.path = null;
  }
  const sp = (W.S.speed * 16) * dt / 1000;
  if (mx || my) {
    const L = Math.hypot(mx, my); mx /= L; my /= L;
    const nx = p.x + mx * sp, ny = p.y + my * sp;
    let moved = false;
    if (!blocked(Math.round(nx), Math.round(ny))) { p.x = nx; p.y = ny; moved = true; }
    else if (!blocked(Math.round(nx), Math.round(p.y))) { p.x = nx; moved = true; }
    else if (!blocked(Math.round(p.x), Math.round(ny))) { p.y = ny; moved = true; }
    if (Math.abs(mx) > Math.abs(my)) p.dir = mx < 0 ? 2 : 3; else p.dir = my < 0 ? 1 : 0;
    if (moved) { p.walkT += dt; W.stuck = 0; } else { W.stuck = (W.stuck || 0) + dt; if (W.stuck > 700) { W.moveTo = null; W.stuck = 0; W.pathT = -1e9; if (W.target) { W.target.unreach = W.t + 8000; W.target = null; } } }
    p.frame = [1, 0, 2, 0][Math.floor(p.walkT / 120) % 4];
  } else p.frame = 0;
  if (p.atkT > 0) p.frame = 3 + Math.min(2, Math.floor((300 - p.atkT) / 100));
  P.x = Math.round(p.x); P.y = Math.round(p.y);
  // cổng dịch chuyển
  const wp = wpAt(P.x, P.y);
  if (wp && !W.onWp) {
    if (W.map.offline && W.P.back && !G.data.maps[wp[0]]) { enterMap(W.P.back.map, W.P.back.x, W.P.back.y + 18); }
    else enterMap(wp[0], wp[1] * 16 + 8, wp[2] * 16 + 8);
    return;
  }
  if (!wp) W.onWp = false;
  // nhặt đồ
  for (const d of W.drops) if (!d.taken && Math.abs(d.x - p.x) < 12 && Math.abs(d.y - p.y) < 12) pickup(d);
  // tự động dùng thuốc
  if (W.auto) {
    if (P.hp < W.S.hpMax * 0.35) usePotion('hp', true);
    if (P.mp < W.S.mpMax * 0.2) usePotion('mp', true);
  }
  // NPC gần
  let near = null, nd = 30;
  for (const n of W.npcs) { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < nd) { nd = d; near = n; } }
  if (near !== W.nearNpc) { W.nearNpc = near; W.ui.setTalk(near); }
}

function goalPoint() {
  const p = W.player;
  if (W.talkTarget) {
    const n = W.talkTarget;
    return { x: n.x, y: n.y + 10, r: 20, done: () => { W.talkTarget = null; W.ui.talk(n); } };
  }
  if (W.target && (W.target.dead || W.target.hp <= 0)) W.target = null;
  if (W.auto && !W.target) {
    if (W.drops.some(d => !d.taken)) {
      const d = W.drops.filter(d => !d.taken).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (Math.hypot(d.x - p.x, d.y - p.y) < 160) return { x: d.x, y: d.y, r: 4 };
    }
    W.target = findMob(p.x, p.y, 400);
  }
  if (W.target && (W.auto || W.chase === W.target)) {
    const m = W.target;
    const type = W.auto ? pickSkill() : (W.pendingSkill ?? 0);
    const range = Math.max(18, St.skillRange(W.P.cls, type) - 4);
    return { x: m.x, y: m.y, r: range, done: () => { tryAttack(type); } };
  }
  if (W.moveTo) return { x: W.moveTo.x, y: W.moveTo.y, r: 3, done: () => { W.moveTo = null; } };
  return null;
}
export function findMob(x, y, r) {
  // ưu tiên quái đi tới được (BFS trên lưới ô)
  const m0 = W.map, fl = flood(x >> 4, y >> 4, 9000, null);
  let best = null, bd = 1e9;
  for (const m of W.mobs) {
    if (m.dead || m.noHit || (m.unreach && m.unreach > W.t)) continue;
    if (W.auto && m.ore) continue;
    if (Math.hypot(m.x - x, m.y - y) > r) continue;
    const tx = m.x >> 4, ty = m.y >> 4;
    let d = 1e9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const X = tx + ox, Y = ty + oy;
      if (X < 0 || Y < 0 || X >= m0.w || Y >= m0.h) continue;
      const v = fl.dist[Y * m0.w + X]; if (v >= 0 && v < d) d = v;
    }
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

// ---- tìm đường BFS trên lưới ô 16px
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function walkTile(m, tx, ty) { return tx >= 0 && ty >= 0 && tx < m.w && ty < m.h && (tileType(m, ty * m.w + tx) & 2) !== 2; }
function flood(sx, sy, maxN, goalFn) {
  const m = W.map, N = m.w * m.h;
  if (!W._dist || W._dist.length < N) { W._dist = new Int32Array(N); W._prev = new Int32Array(N); W._q = new Int32Array(N); }
  const dist = W._dist, prev = W._prev, q = W._q;
  dist.fill(-1, 0, N);
  const s = sy * m.w + sx; let qh = 0, qt = 0, end = -1;
  if (s < 0 || s >= N) return { dist, prev, end };
  dist[s] = 0; prev[s] = -1; q[qt++] = s;
  while (qh < qt) {
    const c = q[qh++], cx = c % m.w, cy = (c / m.w) | 0;
    if (goalFn && goalFn(cx, cy)) { end = c; break; }
    if (qt > maxN) break;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!walkTile(m, nx, ny)) continue;
      if (dx && dy && (!walkTile(m, cx + dx, cy) || !walkTile(m, cx, cy + dy))) continue;
      const n = ny * m.w + nx; if (dist[n] >= 0) continue;
      dist[n] = dist[c] + 1; prev[n] = c; q[qt++] = n;
    }
  }
  return { dist, prev, end };
}
function clearLine(x0, y0, x1, y1) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L / 4);
  for (let i = 1; i <= n; i++) { const k = i / n; if (blocked(Math.round(x0 + (x1 - x0) * k), Math.round(y0 + (y1 - y0) * k))) return false; }
  return true;
}
function steer(goal) {
  const p = W.player;
  const d = Math.hypot(goal.x - p.x, goal.y - p.y);
  if (d <= goal.r) return null;
  if (d < 200 && clearLine(p.x, p.y, goal.x, goal.y)) { W.path = null; return [(goal.x - p.x) / d, (goal.y - p.y) / d]; }
  const gtx = Math.floor(goal.x) >> 4, gty = Math.floor(goal.y) >> 4;
  const key = gtx + ',' + gty + ',' + goal.r;
  if (!W.path || W.pathKey !== key || W.t - W.pathT > 2000) {
    const k = Math.max(0, Math.floor((goal.r - 2) / 16));
    const r = flood(Math.floor(p.x) >> 4, Math.floor(p.y) >> 4, 30000, (x, y) => Math.max(Math.abs(x - gtx), Math.abs(y - gty)) <= k);
    W.pathKey = key; W.pathT = W.t; W.path = null;
    if (r.end < 0) return 'fail';
    const pts = []; let c = r.end;
    while (c >= 0 && r.prev[c] >= 0) { pts.push({ x: (c % W.map.w) * 16 + 8, y: ((c / W.map.w) | 0) * 16 + 8 }); c = r.prev[c]; }
    pts.reverse();
    W.path = pts;
    if (!pts.length) return [(goal.x - p.x) / d, (goal.y - p.y) / d];
  }
  const P = W.path;
  while (P.length > 1 && clearLine(p.x, p.y, P[1].x, P[1].y)) P.shift();
  let n = P[0];
  if (n && Math.hypot(n.x - p.x, n.y - p.y) < 2) { P.shift(); n = P[0]; }
  if (!n) { W.path = null; return [(goal.x - p.x) / d, (goal.y - p.y) / d]; }
  const dd = Math.hypot(n.x - p.x, n.y - p.y) || 1;
  return [(n.x - p.x) / dd, (n.y - p.y) / dd];
}
function pickSkill() {
  const P = W.P;
  const n = CLASSES[P.cls].skills.length;
  for (let s = n - 1; s >= 1; s--) {
    if (BUFF_SKILLS[P.cls].includes(s)) continue;
    if (canUse(s, true)) return s;
  }
  return 0;
}
export function canUse(type, quiet) {
  const P = W.P, lv = P.skills[type];
  if (lv == null || lv <= 0) { quiet || W.ui.log('Chưa học kỹ năng này'); return false; }
  if ((W.cds[type] || 0) > 0) return false;
  const mp = St.skillMP(P.cls, type, lv);
  if (mp > P.mp) { quiet || W.ui.log('Không đủ MP'); return false; }
  return true;
}

// ================== Chiến đấu ==================
W.cds = {};
export function useSkill(type) {
  const P = W.P;
  if (W.dead) return;
  if (BUFF_SKILLS[P.cls].includes(type)) return castBuff(type);
  if (!canUse(type)) return;
  if (!W.target || W.target.dead) W.target = findMob(W.player.x, W.player.y, 160);
  if (!W.target) { W.ui.log('Không có mục tiêu'); return; }
  W.pendingSkill = type; W.chase = W.target;
  const d = Math.hypot(W.target.x - W.player.x, W.target.y - W.player.y);
  if (d <= St.skillRange(P.cls, type)) tryAttack(type);
}
function castBuff(type) {
  const P = W.P, lv = P.skills[type];
  if (!canUse(type)) return;
  const pct = St.skillPct(P.cls, type, lv);
  P._buffs = P._buffs || {};
  const dur = Math.max(10, St.buffTime(type, lv)) * 1000;
  const kind = P.cls === 2 && type === 4 ? 'hpmp' : (type === 4 ? 'atk' : 'def');
  if (P.cls === 2 && type === 6) { // Hồi sinh -> hồi máu
    P.hp = Math.min(W.S.hpMax, P.hp + Math.floor(W.S.hpMax * Math.min(60, pct) / 100));
    addText(W.player.x, W.player.y - 30, '+HP', '#7dff7a');
  } else {
    P._buffs[kind] = { pct: Math.min(80, pct), t: dur };
    addText(W.player.x, W.player.y - 34, CLASSES[P.cls].skills[type], '#ffe27a');
  }
  P.mp -= St.skillMP(P.cls, type, lv);
  W.cds[type] = St.skillCD(P.cls, type, lv);
  W.player.atkT = 300;
  addFx(SKILL_FX[P.cls][1] || 45, W.player.x, W.player.y - 10);
  recalc();
}
function tryAttack(type) {
  const P = W.P, m = W.target, S = W.S;
  if (!m || m.dead) return;
  if (!canUse(type, true)) { if (type !== 0 && canUse(0, true)) type = 0; else return; }
  const wpn = P.body[3];
  if (!wpn || G.data.items[wpn.id].type !== 3 + P.cls) { W.ui.log('Cần trang bị vũ khí phù hợp với môn phái'); W.chase = null; W.auto && W.ui.setAuto(false); return; }
  if (wpn.dur <= 0) { W.ui.log('Vũ khí đã hỏng, hãy sửa ở thợ rèn'); }
  const lv = P.skills[type];
  W.cds[type] = Math.max(St.skillCD(P.cls, type, lv), type === 0 ? 650 : 0);
  P.mp -= St.skillMP(P.cls, type, lv);
  const p = W.player;
  p.dir = Math.abs(m.x - p.x) > Math.abs(m.y - p.y) ? (m.x < p.x ? 2 : 3) : (m.y < p.y ? 1 : 0);
  p.atkT = 300; p.castType = type;
  W.pendingSkill = null; if (!W.auto) W.chase = null;
  W.lastCombat = W.t;
  if (wpn.dur > 0 && Math.random() < 0.15) wpn.dur--;
  // mục tiêu
  let targets = [m];
  if (St.isAoe(P.cls, type) && !m.ore) {
    const R = St.skillRange(P.cls, type) + 40;
    targets = [m, ...W.mobs.filter(o => o !== m && !o.dead && !o.noHit && !o.ore && Math.hypot(o.x - m.x, o.y - m.y) < R).slice(0, 9)];
  }
  const fxId = SKILL_FX[P.cls][type];
  const ranged = P.cls === 2 || P.cls === 4;
  const delay = ranged ? Math.min(400, Math.hypot(m.x - p.x, m.y - p.y) * 2.2) : 120;
  if (ranged && type === 0) W.fx.push({ kind: 'proj', id: fxId || 47, x0: p.x, y0: p.y - 14, x1: m.x, y1: m.y - 10, t: 0, dur: delay });
  setTimeout(() => {
    const isCrit = St.chance(S.crit) || St.chance(S.baoKich);
    const miss = St.chance(2.5, 96.7);
    const xuyen = St.chance(S.xuyen);
    const x2 = St.chance(S.x2);
    let base = miss ? 0 : St.playerDamage(P, S, type, isCrit);
    for (const t of targets) {
      if (t.dead) continue;
      let dmg = t.ore ? (P.body[13] && P.body[13].id === 466 ? 20 : 10) : St.mobInjured(t, P, base, xuyen);
      if (x2 && t === m) dmg *= 2;
      if (fxId != null && (type > 0 || ranged)) addFx(fxId, t.x, t.y - t.t.h / 2);
      else addFx(-1, t.x, t.y - 10);
      hitMob(t, dmg, isCrit && dmg > 0, x2);
    }
  }, delay);
}
function hitMob(m, dmg, crit, x2) {
  const P = W.P;
  if (dmg <= 0) { addText(m.x, m.y - m.t.h, 'MISS', '#ddd'); return; }
  m.hp -= dmg; m.hurt = 300; m.aggro = true;
  addText(m.x, m.y - m.t.h, (crit ? 'Chí mạng ' : '') + '-' + dmg, crit ? '#ff5' : '#fff', crit);
  if (!m.ore) gainExp(St.expGain(m, P, W.S, dmg) * CONFIG.EXP_RATE);
  if (m.hp <= 0) killMob(m);
  W.ui.refreshTarget();
}
function killMob(m) {
  m.dead = true; m.deadT = 0; m.respawn = CONFIG.MOB_RESPAWN_MS; m.hp = 0;
  W.P.kills = (W.P.kills || 0) + 1;
  if (W.target === m) W.target = null;
  const Q = W.P.quest;
  if (Q && Q.mob === m.t.id && Q.have < Q.need) {
    Q.have++; W.ui.log(`Nhiệm vụ: ${m.t.name} ${Q.have}/${Q.need}`, '#ffd76a');
    if (Q.have >= Q.need) W.ui.toast('Hoàn thành nhiệm vụ! Hãy về gặp Trưởng làng');
    W.ui.refreshQuest();
  }
  // rơi đồ (Monster.getItemDrop)
  const R = CONFIG.DROP_RATE, t = m.t;
  const drop = (kind, id, q) => W.drops.push({ kind, id, q, x: m.x + St.rnd(-10, 10), y: m.y + St.rnd(-6, 6), t: 0, taken: false });
  if (m.ore) { drop('xu', 0, St.rnd(20, 60) * CONFIG.XU_RATE); return; }
  if (St.chance(0.8 * R)) drop('potion', St.rnd(1, 6), St.rnd(1, 3));
  if (St.chance(1.3 * R + 6)) drop('xu', 0, St.rnd(t.lv * 15, (t.lv + 10) * 15) * CONFIG.XU_RATE);
  if (St.chance(0.45 * R)) { const id = randomEquip(t.lv, W.P.gender); if (id) drop('equip', id, 1); }
}
function randomEquip(lv, gender) {
  const items = Object.values(G.data.items).filter(i => i.type <= 12 && (i.gender === 0 || i.gender === gender) && i.price > 0);
  let L = lv;
  for (; L > 0; L--) {
    const c = items.filter(i => i.lv === L);
    if (c.length) return c[Math.floor(Math.random() * c.length)].id;
  }
  return null;
}
function pickup(d) {
  const P = W.P;
  if (d.kind === 'equip' && P.bag.length >= P.bagMax) { if (!d.warned) { W.ui.log('Hành trang đã đầy'); d.warned = true; } return; }
  d.taken = true;
  if (d.kind === 'xu') { P.xu += d.q; W.ui.log(`Nhặt được ${d.q.toLocaleString('vi')} xu`, '#ffe28a'); }
  else if (d.kind === 'potion') { P.potions[d.id] = (P.potions[d.id] || 0) + d.q; W.ui.log(`Nhặt được ${d.q} ${G.data.potions[d.id].name}`, '#9fe08a'); }
  else if (d.kind === 'equip') { P.bag.push(St.newEquip(d.id, P.cls)); W.ui.log(`Nhặt được ${G.data.items[d.id].name}`, '#7fc8ff'); }
  W.drops = W.drops.filter(x => !x.taken);
  W.ui.refreshHud();
}
function updateDrops(dt) { for (const d of W.drops) d.t += dt; W.drops = W.drops.filter(d => d.t < 60000); }

export function gainExp(n) {
  const P = W.P;
  P.exp += n;
  let up = false;
  while (P.exp >= St.expNeed(P.level)) {
    P.exp -= St.expNeed(P.level);
    P.level++;
    for (const k of ['str', 'hea', 'agi', 'luck', 'spi']) P.pts[k]++;
    P.pts.skill++; P.pts.base += 5; up = true;
  }
  if (up) {
    recalc(); P.hp = W.S.hpMax; P.mp = W.S.mpMax;
    addFx(45, W.player.x, W.player.y - 16);
    W.ui.toast(`Lên cấp ${P.level}!`);
    W.ui.log(`Chúc mừng! Bạn đạt cấp ${P.level}. Nhận 5 điểm tiềm năng và 1 điểm kỹ năng.`, '#ffe27a');
    W.ui.save(true);
  }
  W.ui.refreshExp();
}

function updateMobs(dt) {
  const p = W.player, P = W.P;
  for (const m of W.mobs) {
    if (m.dead) {
      m.deadT += dt; m.respawn -= dt;
      if (m.respawn <= 0) { m.dead = false; m.hp = m.t.hp; m.x = m.sx; m.y = m.sy; m.aggro = false; }
      continue;
    }
    if (m.hurt > 0) m.hurt -= dt;
    if (m.attackT > 0) m.attackT -= dt;
    const t = m.t;
    const d = Math.hypot(p.x - m.x, p.y - m.y);
    if (!m.passive && !W.dead && t.lv > 7 + Math.floor(P.level / 3) && d < 70) m.aggro = true;
    if (m.aggro && (W.dead || Math.hypot(m.x - m.sx, m.y - m.sy) > 260)) m.aggro = false;
    let gx = null, gy = null, spd = (26 + t.spd * 14) * dt / 1000;
    const canMove = t.mv !== 4 && t.mv !== 0;
    if (m.aggro && !m.passive) {
      const reach = Math.max(20, t.w * 0.6);
      if (d > reach) { if (canMove) { gx = p.x; gy = p.y; spd *= 1.4; } }
      else {
        m.atkCD -= dt;
        if (m.atkCD <= 0) { m.atkCD = 2000; m.attackT = 400; mobAttack(m); }
      }
      if (!canMove && d < 90) { m.atkCD -= dt; if (m.atkCD <= 0) { m.atkCD = 2000; m.attackT = 400; mobAttack(m); } }
    } else if (canMove) {
      m.wanderT -= dt;
      if (m.wanderT <= 0) {
        m.wanderT = 1500 + Math.random() * 3500;
        if (Math.random() < 0.6) { m.tx = m.sx + St.rnd(-40, 40); m.ty = m.sy + St.rnd(-40, 40); }
        else { m.tx = m.x; m.ty = m.y; }
      }
      gx = m.tx; gy = m.ty; spd *= 0.6;
    }
    m.moving = false;
    if (gx != null) {
      const dx = gx - m.x, dy = gy - m.y, L = Math.hypot(dx, dy);
      if (L > 2) {
        const nx = m.x + dx / L * spd, ny = m.y + dy / L * spd;
        const fly = t.mv === 2;
        if (fly || !blocked(Math.round(nx), Math.round(ny))) { m.x = nx; m.y = ny; m.moving = true; }
        else { m.tx = m.x; m.ty = m.y; }
        if (Math.abs(dx) > Math.abs(dy)) m.dir = dx < 0 ? 2 : 3; else m.dir = dy < 0 ? 1 : 0;
      }
    }
  }
}
function mobAttack(m) {
  const P = W.P;
  if (W.dead) return;
  W.lastCombat = W.t;
  const p = W.player;
  m.dir = Math.abs(p.x - m.x) > Math.abs(p.y - m.y) ? (p.x < m.x ? 2 : 3) : (p.y < m.y ? 1 : 0);
  const dmg = St.mobDamage(m, P, W.S);
  if (dmg <= 0) { addText(p.x, p.y - 34, 'Né', '#9cf'); return; }
  P.hp = Math.max(0, P.hp - dmg);
  addText(p.x, p.y - 34, '-' + dmg, '#ff6a5a');
  for (const s of [0, 1, 2]) { const it = P.body[s]; if (it && it.dur > 0 && Math.random() < 0.08) it.dur--; }
  if (!W.target || W.target.dead) W.target = m;
  W.ui.refreshBars();
  if (P.hp <= 0) die();
}
function die() {
  W.dead = true; W.auto && W.ui.setAuto(false);
  W.target = null; W.chase = null;
  for (const m of W.mobs) m.aggro = false;
  W.ui.onDeath();
}
export function revive(inPlace) {
  const P = W.P;
  W.dead = false;
  if (inPlace) { P.hp = Math.floor(W.S.hpMax / 2); P.mp = Math.floor(W.S.mpMax / 2); }
  else { P.hp = W.S.hpMax; P.mp = W.S.mpMax; enterMap(P.village || 0, 384, 672); }
  W.ui.refreshBars();
}
export function usePotion(kind, quiet) {
  const P = W.P, S = W.S;
  if (W.dead) return;
  const ids = kind === 'hp' ? HP_IDS : MP_IDS;
  const vals = G.data.others.VALUE_MP_HP[kind === 'hp' ? 0 : 1];
  if ((W.potCD && W.potCD[kind] || 0) > W.t) return;
  if (kind === 'hp' && P.hp >= S.hpMax) return; if (kind === 'mp' && P.mp >= S.mpMax) return;
  // ưu tiên loại đã chọn, sau đó loại nhỏ nhất còn
  let pick = kind === 'hp' ? P.quickHp : P.quickMp;
  if (!(P.potions[pick] > 0)) pick = ids.find(i => P.potions[i] > 0);
  if (!pick) { quiet || W.ui.log(`Hết bình ${kind.toUpperCase()}`); return; }
  const v = vals[ids.indexOf(pick)] || 100;
  P.potions[pick]--; if (P.potions[pick] <= 0) delete P.potions[pick];
  if (kind === 'hp') P.hp = Math.min(S.hpMax, P.hp + v); else P.mp = Math.min(S.mpMax, P.mp + v);
  W.potCD = W.potCD || {}; W.potCD[kind] = W.t + 500;
  addText(W.player.x, W.player.y - 30, `+${v} ${kind.toUpperCase()}`, kind === 'hp' ? '#7dff7a' : '#7ac0ff');
  W.ui.refreshHud();
}

export function addText(x, y, s, color, big) { W.texts.push({ x, y, s, color, big, t: 0 }); }
export function addFx(id, x, y) {
  const f = G.data.fx[id];
  if (id === -1 || !f) { W.fx.push({ kind: 'hit', x, y, t: 0, dur: 200 }); return; }
  W.fx.push({ kind: 'fx', id, x, y, t: 0, dur: Math.max(300, f[2] * 80), w: f[0], h: f[1], n: f[2] });
}

// ================== Vẽ ==================
export function draw(ctx) {
  const { vw, vh } = W;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, vw, vh);
  if (!W.map) return;
  const p = W.player, m = W.map;
  const mw = m.w * 16, mh = m.h * 16;
  let cx = Math.round(p.x - vw / 2), cy = Math.round(p.y - 10 - vh / 2);
  cx = mw <= vw ? Math.round((mw - vw) / 2) : Math.max(0, Math.min(mw - vw, cx));
  cy = mh <= vh ? Math.round((mh - vh) / 2) : Math.max(0, Math.min(mh - vh, cy));
  W.cam.x = cx; W.cam.y = cy;
  ctx.save();
  ctx.translate(-cx, -cy);
  const mc = mapCanvas(m);
  if (mc) {
    const sx = Math.max(0, cx), sy = Math.max(0, cy);
    const sw = Math.min(vw, mw - sx), sh = Math.min(vh, mh - sy);
    if (sw > 0 && sh > 0) ctx.drawImage(mc, sx, sy, sw, sh, sx, sy, sw, sh);
  }
  // waypoints sáng nhẹ
  ctx.fillStyle = `rgba(255,230,120,${0.12 + 0.08 * Math.sin(W.t / 300)})`;
  for (const w of m.wps) ctx.fillRect(w[3] * 16, w[4] * 16, 16, 16);
  // drop
  for (const d of W.drops) drawDrop(ctx, d);
  // sprite sort
  const list = [];
  const inView = (x, y, r = 80) => x > cx - r && x < cx + vw + r && y > cy - r && y < cy + vh + r * 1.5;
  for (const t of W.trees) if (inView(t.x, t.y, 140)) list.push({ y: t.sy, f: () => { const im = img(`img/tree/${t.id}.png`); im && ctx.drawImage(im, t.x, t.y); } });
  for (const n of W.npcs) if (inView(n.x, n.y)) list.push({ y: n.y, f: () => { drawChar(ctx, n.look, n.x, n.y, n.dir, 0); } });
  for (const mo of W.mobs) if ((!mo.dead || mo.deadT < 500) && inView(mo.x, mo.y)) list.push({ y: mo.y, f: () => drawMob(ctx, mo, W.t) });
  list.push({ y: p.y, f: () => drawPlayer(ctx) });
  list.sort((a, b) => a.y - b.y);
  // vòng chọn mục tiêu
  if (W.target && !W.target.dead) {
    const t = W.target;
    ctx.strokeStyle = '#ffd34a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(t.x, t.y + 1, Math.max(8, t.t.w / 2.4), 4, 0, 0, Math.PI * 2); ctx.stroke();
  }
  for (const s of list) s.f();
  drawTop(ctx, m, W.cam, vw, vh);
  // fx
  for (const f of W.fx) drawFx(ctx, f);
  // tên
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = '600 6px "Segoe UI",Arial';
  for (const n of W.npcs) if (inView(n.x, n.y)) label(ctx, n.name, n.x, n.y - 34, '#ffe27a');
  if (W.target && !W.target.dead) {
    const t = W.target, top = t.y - t.t.h - 4;
    label(ctx, `${t.t.name} Lv${t.t.lv}`, t.x, top - 3, t.t.lv > W.P.level + 3 ? '#ff7a6a' : '#fff');
    ctx.fillStyle = '#000a'; ctx.fillRect(t.x - 14, top, 28, 3);
    ctx.fillStyle = '#e8452f'; ctx.fillRect(t.x - 14, top, 28 * Math.max(0, t.hp / t.t.hp), 3);
  }
  label(ctx, W.P.name, p.x, p.y - 34, '#bfe9ff');
  // chữ sát thương
  for (const tx of W.texts) {
    ctx.globalAlpha = Math.min(1, (1100 - tx.t) / 300);
    ctx.font = (tx.big ? '700 9px' : '700 7px') + ' "Segoe UI",Arial';
    ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.strokeText(tx.s, tx.x, tx.y);
    ctx.fillStyle = tx.color; ctx.fillText(tx.s, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
function label(ctx, s, x, y, c) {
  ctx.lineWidth = 2; ctx.strokeStyle = '#000c'; ctx.strokeText(s, x, y); ctx.fillStyle = c; ctx.fillText(s, x, y);
}
function drawPlayer(ctx) {
  const p = W.player;
  if (W.dead) ctx.globalAlpha = 0.5;
  const swing = p.atkT > 0 ? 1 - p.atkT / 300 : null;
  drawChar(ctx, W.look, p.x, p.y, p.dir, p.frame, { swing });
  ctx.globalAlpha = 1;
}
function drawDrop(ctx, d) {
  const bob = Math.round(Math.sin(W.t / 250 + d.x) * 1.5);
  ctx.save(); ctx.translate(Math.round(d.x), Math.round(d.y) + bob);
  if (d.t > 50000 && Math.floor(W.t / 150) % 2) ctx.globalAlpha = 0.4;
  if (d.kind === 'xu') { const im = img('img/icon/potion.png'); im && ctx.drawImage(im, 0, 0, 16, 16, -8, -12, 16, 16); }
  else if (d.kind === 'potion') { const im = img('img/icon/potion.png'); const t = G.data.potions[d.id]; im && t && ctx.drawImage(im, 0, t.img * 16, 16, 16, -8, -12, 16, 16); }
  else {
    const t = G.data.items[d.id], k = G.data.iconIdx[t.icon], im = img('img/icon/items.png');
    ctx.fillStyle = 'rgba(120,200,255,.35)'; ctx.beginPath(); ctx.arc(0, -4, 9, 0, 7); ctx.fill();
    im && k != null && ctx.drawImage(im, (k % 32) * 16, Math.floor(k / 32) * 16, 16, 16, -8, -12, 16, 16);
  }
  ctx.restore();
}
function drawFx(ctx, f) {
  if (f.kind === 'hit') {
    ctx.strokeStyle = `rgba(255,255,255,${1 - f.t / f.dur})`; ctx.lineWidth = 2;
    const r = 4 + f.t / 20;
    ctx.beginPath(); ctx.moveTo(f.x - r, f.y - r); ctx.lineTo(f.x + r, f.y + r); ctx.moveTo(f.x + r, f.y - r); ctx.lineTo(f.x - r, f.y + r); ctx.stroke();
    return;
  }
  if (f.kind === 'proj') {
    const k = f.t / f.dur, x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k;
    const info = G.data.fx[f.id]; const im = img(`img/fx/${f.id}.png`);
    if (im && info) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(f.y1 - f.y0, f.x1 - f.x0) + Math.PI / 2);
      ctx.drawImage(im, 0, 0, info[0], info[1], -info[0] / 2, -info[1] / 2, info[0], info[1]); ctx.restore();
    } else { ctx.fillStyle = '#9cf'; ctx.fillRect(x - 2, y - 2, 4, 4); }
    return;
  }
  const im = img(`img/fx/${f.id}.png`); if (!im) return;
  const fr = Math.min(f.n - 1, Math.floor(f.t / f.dur * f.n));
  ctx.drawImage(im, 0, fr * f.h, f.w, f.h, Math.round(f.x - f.w / 2), Math.round(f.y - f.h / 2), f.w, f.h);
}

// ================== Điều khiển ==================
export function screenToWorld(sx, sy) { return { x: sx / W.scale + W.cam.x, y: sy / W.scale + W.cam.y }; }
export function clickWorld(x, y) {
  if (W.dead) return;
  // NPC
  for (const n of W.npcs) if (Math.abs(n.x - x) < 10 && y > n.y - 32 && y < n.y + 4) { W.talkTarget = n; W.target = null; W.chase = null; return; }
  // quái
  let best = null, bd = 18;
  for (const m of W.mobs) {
    if (m.dead || m.noHit) continue;
    const d = Math.hypot(m.x - x, (m.y - m.t.h / 2) - y);
    if (d < Math.max(bd, m.t.w / 1.6) && (!best || d < bd)) { best = m; bd = d; }
  }
  if (best) { W.target = best; W.chase = best; W.pendingSkill = 0; W.moveTo = null; W.ui.refreshTarget(); return; }
  W.moveTo = { x, y }; W.chase = null;
}
export function attackNearest() {
  if (!W.target || W.target.dead) W.target = findMob(W.player.x, W.player.y, 200);
  if (W.target) { W.chase = W.target; W.pendingSkill = 0; W.ui.refreshTarget(); }
  else if (W.nearNpc) W.ui.talk(W.nearNpc);
}
