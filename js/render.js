// Vẽ nhân vật ghép (paper-doll), quái, bản đồ
import { G, img } from './data.js';

// ---- nhân vật: look = {head, body, leg, hat, cape, weapon}
// dir: 0 xuống, 1 lên, 2 trái, 3 phải.  frame: 0 đứng, 1-2 đi, 3-5 đánh
export function drawChar(ctx, look, x, y, dir, frame, opts = {}) {
  const P = G.data.parts;
  const flip = dir === 2;
  const d = dir === 2 ? 2 : dir;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  const sh = img('img/ui/shadow.png');
  if (sh && !opts.noShadow) ctx.drawImage(sh, -Math.floor(sh.width / 2), -Math.floor(sh.height / 2) - 1);
  const part = (t, id) => {
    const p = P[t] && P[t][id]; if (!p) return;
    const im = img(`img/cloth/${t}/${id}.png`); if (!im) return;
    const xs = p.x[d]; if (!xs) return;
    const fi = Math.min(frame, xs.length - 1);
    const w = p.w[d][fi], h = p.h[d][fi]; if (!w || !h) return;
    const dx = p.dx[d][Math.min(frame, p.dx[d].length - 1)], dy = p.dy[d][Math.min(frame, p.dy[d].length - 1)];
    ctx.drawImage(im, xs[fi], p.y[d][fi], w, h, dx, dy, w, h);
  };
  const weapon = () => look.weapon != null && drawWeapon(ctx, look, d, frame, opts.swing);
  const back = d === 1;
  if (!back) weapon();
  part(0, look.leg ?? 0);
  part(1, look.body ?? 0);
  part(2, look.head ?? 0);
  if (look.hat != null && look.hat >= 0) part(3, look.hat);
  if (back) weapon();
  ctx.restore();
}

function drawWeapon(ctx, look, d, frame, swing) {
  const im = img(`img/weapon/${look.weapon}.png`); if (!im) return;
  const it = G.data.items[look.weapon];
  const isBow = it && it.type === 7;
  const sc = Math.min(1, 34 / Math.max(im.width, im.height));
  ctx.save();
  // tay cầm: góc dưới của ảnh
  let hx = d === 1 ? -6 : 6, hy = -12;
  if (d >= 2) hx = 3;
  ctx.translate(hx, hy);
  let ang = d === 1 ? -0.5 : 0.45;
  if (d >= 2) ang = 0.9;
  if (swing != null) { // 0..1
    const s = Math.sin(swing * Math.PI);
    ang += (d === 1 ? -1 : 1) * (s * 1.6 - 0.4);
  }
  if (isBow) { ang = d >= 2 ? 0 : (d === 1 ? -0.2 : 0.2); if (d === 0) ctx.translate(2, 2); }
  ctx.rotate(ang);
  ctx.scale(sc * (isBow ? 0.75 : 1), sc * (isBow ? 0.75 : 1));
  ctx.drawImage(im, -im.width / 2, -im.height + 4);
  ctx.restore();
}

// Ảnh chân dung (avatar) — vẽ đầu nhân vật
export function drawAvatar(ctx, look, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.save(); ctx.scale(1.6, 1.6);
  drawChar(ctx, look, w / 3.2, h / 1.6 + 8, 0, 0, { noShadow: true });
  ctx.restore();
}

// ---- quái
export function drawMob(ctx, mob, t) {
  const M = mob.t;
  const im = img(`img/mob/${M.id}.png`); if (!im) return;
  ctx.save();
  ctx.translate(Math.round(mob.x), Math.round(mob.y));
  if (mob.hurt > 0 && (Math.floor(t / 60) % 2)) ctx.globalAlpha = 0.55;
  if (mob.dead) ctx.globalAlpha = Math.max(0, 1 - mob.deadT / 500);
  const sh = img('img/ui/shadow.png');
  if (sh && M.mv !== 2) ctx.drawImage(sh, -Math.floor(sh.width / 2), -Math.floor(sh.height / 2) - 1);
  let fw = M.w, fh = M.h;
  if (M.kind === 'static') {
    const s = Math.min(1, 80 / Math.max(im.width, im.height));
    ctx.scale(s, s);
    ctx.drawImage(im, -im.width / 2, -im.height + 4);
    ctx.restore(); return;
  }
  const n = M.n;
  let base = 0, anim = 2;
  const back = mob.dir === 1;
  if (n >= 8) { base = mob.attackT > 0 ? (back ? 6 : 2) : (back ? 4 : 0); }
  else if (n >= 4) { base = back ? 2 : 0; }
  else if (n === 1) anim = 1;
  else anim = n;
  const f = base + (anim > 1 ? Math.floor(t / (mob.moving || mob.attackT > 0 ? 180 : 320) + mob.phase) % anim : 0);
  if (mob.dir === 3) ctx.scale(-1, 1);
  const bob = M.mv === 2 ? Math.round(Math.sin(t / 300 + mob.phase) * 2) - 6 : 0;
  ctx.drawImage(im, 0, f * fh, fw, fh, -Math.floor(fw / 2), -fh + 3 + bob, fw, fh);
  ctx.restore();
}

// ---- bản đồ: vẽ sẵn lớp nền vào canvas phụ
const mapCache = {};
export function mapCanvas(map) {
  if (mapCache[map.id]) return mapCache[map.id];
  const sheet = img(`img/tiles/${map.ts}.png`);
  if (!sheet) return null;
  const c = document.createElement('canvas');
  c.width = map.w * 16; c.height = map.h * 16;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  const n = sheet.height / 16;
  for (let i = 0; i < map.tiles.length; i++) {
    const k = map.tiles[i];
    if (k < 0 || k >= n) continue;
    x.drawImage(sheet, 0, k * 16, 16, 16, (i % map.w) * 16, Math.floor(i / map.w) * 16, 16, 16);
  }
  mapCache[map.id] = c;
  return c;
}
export function drawTop(ctx, map, cam, vw, vh) {
  const sheet = img(`img/tiles/${map.ts}.png`); if (!sheet) return;
  for (const [k, tx, ty] of map.tops) {
    const px = tx * 16, py = ty * 16;
    if (px + 16 < cam.x || py + 16 < cam.y || px > cam.x + vw || py > cam.y + vh) continue;
    ctx.drawImage(sheet, 0, k * 16, 16, 16, px, py, 16, 16);
  }
}

// ---- icon vật phẩm
export function drawItemIcon(ctx, kind, id, x = 0, y = 0, size = 16) {
  ctx.imageSmoothingEnabled = false;
  if (kind === 'equip') {
    const t = G.data.items[id]; if (!t) return;
    const k = G.data.iconIdx[t.icon];
    const im = img('img/icon/items.png');
    if (im && k != null) ctx.drawImage(im, (k % 32) * 16, Math.floor(k / 32) * 16, 16, 16, x, y, size, size);
  } else if (kind === 'potion') {
    const t = G.data.potions[id]; if (!t) return;
    const im = img('img/icon/potion.png');
    if (im && t.img < 100) ctx.drawImage(im, 0, t.img * 16, 16, 16, x, y, size, size);
  } else if (kind === 'skill') {
    const [cls, sk] = id;
    const im = img(`img/skill/${cls}.png`);
    if (im) ctx.drawImage(im, 0, sk * 20, 20, 20, x, y, size, size);
  }
}
export function iconCanvas(kind, id, size = 16) {
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const draw = () => { ctx.clearRect(0, 0, size, size); drawItemIcon(ctx, kind, id, 0, 0, size); };
  draw(); setTimeout(draw, 300);
  return c;
}
