// Giao diện: HUD, cửa sổ, hội thoại, cửa hàng, lưu game
import { G, CLASSES, NPC_LINES, SLOT_NAMES, ATT_NAMES, INTRO, BUFF_SKILLS } from './data.js';
import { W, recalc, enterMap, usePotion, useSkill, revive, lookOf, gainExp } from './game.js';
import { drawItemIcon, iconCanvas, drawAvatar, mapCanvas } from './render.js';
import * as St from './stats.js';
import { CONFIG } from './config.js';
import { Cloud } from './cloud.js';

const $ = (s) => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else if (k === 'html') e.innerHTML = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const fmt = (n) => Math.floor(n).toLocaleString('vi-VN');
export const SAVE_KEY = 'kpah_offline_save_v1';

export const UI = {
  win: null,
  init() {
    W.ui = this;
    document.querySelectorAll('#menu-btns button').forEach(b => b.onclick = () => this.open(b.dataset.ui));
    $('#win-close').onclick = () => this.close();
    $('#btn-auto').onclick = () => this.setAuto(!W.auto);
    $('#pot-hp').onclick = () => usePotion('hp');
    $('#pot-mp').onclick = () => usePotion('mp');
    $('#btn-talk').onclick = () => W.nearNpc && this.talk(W.nearNpc);
    this.buildSkillBar();
  },
  // ---------- HUD ----------
  refreshHud() {
    if (!W.P) return;
    const P = W.P;
    $('#hud-name').textContent = `${P.name} · ${CLASSES[P.cls].name}`;
    $('#hud-lv').textContent = P.level;
    $('#hud-xu').textContent = fmt(P.xu) + ' xu';
    this.refreshBars(); this.refreshExp(); this.refreshPots();
    const av = () => drawAvatar($('#avatar-cv').getContext('2d'), W.look || lookOf(P), 40, 40);
    av(); setTimeout(av, 400); setTimeout(av, 1500);
    this.refreshQuest();
  },
  refreshQuest() {
    const Q = W.P && W.P.quest, el = $('#quest');
    if (!Q) { el.classList.add('hidden'); return; }
    const m = G.data.mobs[Q.mob];
    el.classList.remove('hidden');
    el.textContent = Q.have >= Q.need ? `✔ Nhiệm vụ xong — về gặp Trưởng làng` : `Nhiệm vụ: ${m.name} ${Q.have}/${Q.need} (${Q.where})`;
  },
  refreshBars() {
    const P = W.P, S = W.S;
    $('.bar.hp i').style.width = (100 * P.hp / S.hpMax) + '%'; $('.bar.hp b').textContent = `${fmt(P.hp)} / ${fmt(S.hpMax)}`;
    $('.bar.mp i').style.width = (100 * P.mp / S.mpMax) + '%'; $('.bar.mp b').textContent = `${fmt(P.mp)} / ${fmt(S.mpMax)}`;
    this.refreshPots();
  },
  refreshExp() {
    const P = W.P, need = St.expNeed(P.level);
    $('#exp-bar i').style.width = (100 * P.exp / need) + '%';
    $('#exp-bar b').textContent = `Cấp ${P.level} · ${(100 * P.exp / need).toFixed(2)}%`;
  },
  refreshPots() {
    const P = W.P;
    const cnt = (ids) => ids.reduce((s, i) => s + (P.potions[i] || 0), 0);
    const hp = [1, 2, 3, 21, 22, 93, 94], mp = [4, 5, 6, 23, 24, 95, 96];
    $('#pot-hp span').textContent = cnt(hp); $('#pot-mp span').textContent = cnt(mp);
    const ch = $('#pot-hp canvas').getContext('2d'); ch.clearRect(0, 0, 16, 16); drawItemIcon(ch, 'potion', hp.find(i => P.potions[i]) || 1);
    const cm = $('#pot-mp canvas').getContext('2d'); cm.clearRect(0, 0, 16, 16); drawItemIcon(cm, 'potion', mp.find(i => P.potions[i]) || 4);
  },
  refreshTarget() {},
  onMapChange() {
    $('#map-name').textContent = W.map.name || (W.map.offline ? 'Trong nhà' : 'Bản đồ ' + W.map.id);
    if (this.win === 'map') this.open('map');
  },
  buildSkillBar() {
    const box = $('#skill-slots'); box.innerHTML = '';
    if (!W.P) return;
    W.P.slots.forEach((sk, i) => {
      const b = h('button', { class: 'sk', title: '' });
      b.append(h('span', { class: 'key' }, String(i + 1)));
      if (sk >= 0) {
        b.append(iconCanvas('skill', [W.P.cls, sk], 20));
        b.title = CLASSES[W.P.cls].skills[sk];
        if (!(W.P.skills[sk] > 0)) b.classList.add('lock');
      }
      const cd = h('div', { class: 'cd' }); cd.style.transform = 'scaleY(0)'; b.append(cd);
      b.onclick = () => sk >= 0 ? useSkill(sk) : this.open('skill');
      box.append(b);
    });
  },
  tickCooldowns() {
    if (!W.P) return;
    const btns = document.querySelectorAll('#skill-slots .sk');
    W.P.slots.forEach((sk, i) => {
      const cd = btns[i] && btns[i].querySelector('.cd'); if (!cd || sk < 0) return;
      const tot = St.skillCD(W.P.cls, sk, W.P.skills[sk]) || 1;
      cd.style.transform = `scaleY(${Math.min(1, (W.cds[sk] || 0) / tot)})`;
    });
    const t = W.target;
    const box = $('#target');
    if (t && !t.dead) {
      box.classList.remove('hidden');
      $('#target-name').textContent = `${t.t.name} (Lv ${t.t.lv})`;
      $('#target .thp i').style.width = (100 * Math.max(0, t.hp) / t.t.hp) + '%';
      $('#target .thp b').textContent = `${fmt(Math.max(0, t.hp))} / ${fmt(t.t.hp)}`;
    } else box.classList.add('hidden');
  },
  setAuto(v) { W.auto = v; $('#btn-auto').classList.toggle('on', v); if (!v) { W.target = null; W.chase = null; } this.log(v ? 'Bật tự động đánh' : 'Tắt tự động đánh'); },
  setTalk(n) { $('#btn-talk').classList.toggle('hidden', !n); if (n) $('#btn-talk').textContent = 'Nói chuyện: ' + n.name; },
  log(s, color) {
    const d = h('div', {}, s); if (color) d.style.color = color;
    const L = $('#log'); L.append(d); while (L.children.length > 7) L.firstChild.remove();
  },
  toast(s) { const d = h('div', {}, s); $('#toast').append(d); setTimeout(() => d.remove(), 3000); },

  // ---------- Cửa sổ ----------
  open(kind, arg) {
    this.win = kind; W.paused = false;
    $('#win').classList.remove('hidden');
    const body = $('#win-body'); body.innerHTML = '';
    const title = $('#win-title');
    const f = { bag: this.wBag, char: this.wChar, skill: this.wSkill, map: this.wMap, sys: this.wSys, shop: this.wShop, travel: this.wTravel, learn: this.wLearn, repair: this.wRepair }[kind];
    f.call(this, body, title, arg);
  },
  close() { $('#win').classList.add('hidden'); this.win = null; },
  reopen() { if (this.win) this.open(this.win, this._arg); },

  wBag(body, title) {
    title.textContent = 'Hành trang';
    const P = W.P;
    let sel = this._bagSel || null;
    const info = h('div', { class: 'info' }, 'Chọn một vật phẩm để xem.');
    const equip = h('div', { class: 'equip' });
    for (const s of [2, 0, 1, 3, 19, 8, 9, 10, 11, 12]) {
      const it = P.body[s];
      const sl = h('div', { class: 'slot' + (it ? ' c' + (G.data.items[it.id].color || 0) : '') }, h('span', { class: 'lbl' }, SLOT_NAMES[s]));
      if (it) sl.append(iconCanvas('equip', it.id));
      sl.onclick = () => { if (it) showEquip(it, 'body', s); };
      equip.append(sl);
    }
    const grid = h('div', { class: 'grid' });
    P.bag.forEach((it, i) => {
      const t = G.data.items[it.id];
      const sl = h('div', { class: 'slot c' + (t.color || 0) }, iconCanvas('equip', it.id));
      if (!canWear(t)) sl.style.opacity = .55;
      sl.onclick = () => { grid.querySelectorAll('.slot').forEach(x => x.classList.remove('sel')); sl.classList.add('sel'); showEquip(it, 'bag', i); };
      grid.append(sl);
    });
    for (const id in P.potions) {
      const sl = h('div', { class: 'slot' }, iconCanvas('potion', +id), h('span', { class: 'q' }, P.potions[id]));
      sl.onclick = () => showPotion(+id);
      grid.append(sl);
    }
    const self = this;
    function showEquip(it, where, idx) {
      const t = G.data.items[it.id];
      info.innerHTML = '';
      info.append(h('h4', {}, t.name + (it.plus ? ` +${it.plus}` : '')));
      const req = [];
      req.push(h('div', { class: 'req' + (t.lv > P.level ? ' bad' : '') }, `Yêu cầu cấp: ${t.lv}`));
      if (t.cls >= 0) req.push(h('div', { class: 'req' + (t.cls !== P.cls ? ' bad' : '') }, `Môn phái: ${CLASSES[t.cls].name}`));
      if (t.gender) req.push(h('div', { class: 'req' + (t.gender !== P.gender ? ' bad' : '') }, t.gender === 1 ? 'Dành cho nam' : 'Dành cho nữ'));
      info.append(...req);
      for (const [a, v] of it.att) info.append(h('div', { class: 'att' }, `${(G.data.attrs[a] || { name: ATT_NAMES[a] }).name}: +${v}`));
      if (it.mdur) info.append(h('div', { class: 'req' + (it.dur <= 0 ? ' bad' : '') }, `Độ bền: ${it.dur}/${it.mdur}`));
      info.append(h('div', { class: 'req' }, `Giá bán: ${fmt(sellPrice(it))} xu`));
      const row = h('div', { class: 'btnrow' });
      if (where === 'bag') {
        row.append(h('button', { onclick: () => { equipItem(idx); } }, 'Mặc / Trang bị'));
        row.append(h('button', { onclick: () => { P.xu += sellPrice(it); P.bag.splice(idx, 1); self.log(`Đã bán ${t.name}`); self.refreshHud(); self.open('bag'); } }, 'Bán'));
      } else {
        row.append(h('button', { onclick: () => { if (P.bag.length >= P.bagMax) return self.toast('Hành trang đầy'); delete P.body[idx]; P.bag.push(it); recalc(); self.open('bag'); } }, 'Tháo ra'));
      }
      info.append(row);
    }
    function showPotion(id) {
      const t = G.data.potions[id];
      info.innerHTML = '';
      info.append(h('h4', {}, t.name), h('div', { class: 'req' }, t.desc), h('div', { class: 'req' }, `Số lượng: ${P.potions[id]}`));
      const isHp = [1, 2, 3, 21, 22, 93, 94].includes(id), isMp = [4, 5, 6, 23, 24, 95, 96].includes(id);
      const row = h('div', { class: 'btnrow' });
      if (isHp || isMp) {
        row.append(h('button', { onclick: () => { if (isHp) P.quickHp = id; else P.quickMp = id; usePotion(isHp ? 'hp' : 'mp'); self.open('bag'); } }, 'Dùng'));
        row.append(h('button', { onclick: () => { if (isHp) P.quickHp = id; else P.quickMp = id; self.toast('Đã đặt làm bình dùng nhanh'); } }, 'Đặt dùng nhanh'));
      }
      if (id === 19) row.append(h('button', { onclick: () => { P.potions[19]--; if (!P.potions[19]) delete P.potions[19]; self.close(); enterMap(P.village || 0, 384, 672); } }, 'Về làng'));
      row.append(h('button', { onclick: () => { const q = P.potions[id]; P.xu += Math.floor((t.price || 0) / 2) * q; delete P.potions[id]; self.refreshHud(); self.open('bag'); } }, 'Bán hết'));
      info.append(row);
    }
    function equipItem(i) {
      const it = P.bag[i], t = G.data.items[it.id];
      if (!canWear(t)) return self.toast('Không thể trang bị vật phẩm này');
      const s = St.slotOf(t); if (s < 0) return self.toast('Vật phẩm này không mặc được');
      P.bag.splice(i, 1);
      if (P.body[s]) P.bag.push(P.body[s]);
      P.body[s] = it; recalc(); self.open('bag');
    }
    body.append(h('div', { class: 'req', style: 'color:#ffe28a;margin-bottom:6px' }, `Xu: ${fmt(P.xu)} · Hành trang ${P.bag.length}/${P.bagMax}`), equip, grid, info);
  },

  wChar(body, title) {
    title.textContent = 'Nhân vật';
    const P = W.P, S = W.S;
    const pts = h('div', {});
    const names = { str: 'Sức mạnh', agi: 'Nhanh nhẹn', spi: 'Tinh thần', hea: 'Sức khoẻ', luck: 'May mắn' };
    pts.append(h('div', { class: 'req', style: 'margin-bottom:4px' }, `Điểm tiềm năng còn: ${P.pts.base}`));
    for (const k in names) {
      const add = (n) => { n = Math.min(n, P.pts.base); if (n <= 0) return; P.pts[k] += n; P.pts.base -= n; recalc(); this.open('char'); };
      pts.append(h('div', { class: 'pt' }, h('span', {}, `${names[k]}: ${P.pts[k]}`),
        h('span', {}, h('button', { onclick: () => add(1) }, '+1'), ' ', h('button', { onclick: () => add(5) }, '+5'))));
    }
    const stats = h('div', { class: 'stats' });
    const rows = [['Cấp', P.level], ['Môn phái', CLASSES[P.cls].name + ' (' + CLASSES[P.cls].he + ')'], ['HP', `${fmt(P.hp)}/${fmt(S.hpMax)}`], ['MP', `${fmt(P.mp)}/${fmt(S.mpMax)}`],
      ['Tấn công', fmt(S.atk)], ['Thủ vật', fmt(S.def)], ['Thủ ma', fmt(S.mdef)], ['Chính xác', S.acc], ['Né tránh', S.dodge], ['Chí mạng', S.crit + '%'],
      ['Xuyên giáp', S.xuyen + '%'], ['Kinh nghiệm', `${fmt(P.exp)}/${fmt(St.expNeed(P.level))}`], ['Quái đã hạ', fmt(P.kills || 0)], ['Xu', fmt(P.xu)]];
    for (const [a, b] of rows) stats.append(h('div', {}, h('span', {}, a), h('b', {}, String(b))));
    body.append(stats, h('h4', { style: 'color:#f2c35b;margin:10px 0 4px' }, 'Cộng điểm'), pts);
  },

  wSkill(body, title) {
    title.textContent = 'Kỹ năng';
    const P = W.P, C = CLASSES[P.cls];
    body.append(h('div', { class: 'req', style: 'margin-bottom:6px' }, `Điểm kỹ năng còn: ${P.pts.skill}. Bấm "Gắn" để đặt kỹ năng vào phím 1–5.`));
    const list = h('div', { class: 'list' });
    C.skills.forEach((name, i) => {
      const lv = P.skills[i];
      const reqNext = lv >= 0 ? St.skillReqLv(i, lv) : 0;
      const buff = BUFF_SKILLS[P.cls].includes(i);
      let desc;
      if (lv < 0) desc = 'Chưa học — mua sách kỹ năng ở Trưởng làng';
      else {
        const L = Math.max(1, lv);
        desc = `${buff ? 'Hỗ trợ' : 'Sát thương'} +${St.skillPct(P.cls, i, L)}% · MP ${St.skillMP(P.cls, i, L)} · Hồi ${(St.skillCD(P.cls, i, L) / 1000).toFixed(1)}s · Tầm ${St.skillRange(P.cls, i)}`;
      }
      const row = h('div', { class: 'skrow' }, iconCanvas('skill', [P.cls, i], 20),
        h('div', { class: 'grow' }, h('b', {}, `${name} ${lv > 0 ? 'Lv ' + lv : ''}`), h('small', {}, desc),
          lv >= 0 && lv < 9 ? h('small', {}, `Cấp nhân vật cần để nâng: ${reqNext}`) : null));
      if (lv >= 0 && lv < 9) row.append(h('button', { onclick: () => {
        if (P.pts.skill <= 0) return this.toast('Không đủ điểm kỹ năng');
        if (P.level < reqNext) return this.toast(`Cần đạt cấp ${reqNext}`);
        P.pts.skill--; P.skills[i]++; recalc(); this.buildSkillBar(); this.open('skill');
      } }, '+'));
      if (lv > 0) row.append(h('button', { onclick: () => {
        const slot = P.slots.indexOf(i); if (slot >= 0) P.slots[slot] = -1;
        const free = P.slots.indexOf(-1); P.slots[free >= 0 ? free : 4] = i; this.buildSkillBar(); this.open('skill');
      } }, P.slots.includes(i) ? `Phím ${P.slots.indexOf(i) + 1}` : 'Gắn'));
      list.append(row);
    });
    body.append(list);
  },

  wMap(body, title) {
    title.textContent = 'Bản đồ: ' + (W.map.name || W.map.id);
    const mc = mapCanvas(W.map);
    const c = h('canvas', { id: 'minimap' });
    const sc = Math.min(1, 520 / (W.map.w * 16));
    c.width = Math.round(W.map.w * 16 * sc); c.height = Math.round(W.map.h * 16 * sc);
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true;
    if (mc) x.drawImage(mc, 0, 0, c.width, c.height);
    x.fillStyle = '#ff3'; x.beginPath(); x.arc(W.player.x * sc, W.player.y * sc, 4, 0, 7); x.fill();
    x.fillStyle = '#f80'; for (const n of W.npcs) x.fillRect(n.x * sc - 2, n.y * sc - 2, 4, 4);
    x.fillStyle = '#f33'; for (const m of W.mobs) if (!m.dead) x.fillRect(m.x * sc - 1, m.y * sc - 1, 2, 2);
    x.font = '11px Segoe UI'; x.textAlign = 'center';
    const seen = new Set();
    for (const w of W.map.wps) {
      const k = w[0]; if (seen.has(k)) continue; seen.add(k);
      const nm = G.data.maps[k] && G.data.maps[k].name; if (!nm) continue;
      x.fillStyle = '#000a'; x.fillText(nm, w[3] * 16 * sc + 1, w[4] * 16 * sc + 1); x.fillStyle = '#ffe27a'; x.fillText(nm, w[3] * 16 * sc, w[4] * 16 * sc);
    }
    c.onclick = (e) => { const r = c.getBoundingClientRect(); W.moveTo = { x: (e.clientX - r.left) / r.width * c.width / sc, y: (e.clientY - r.top) / r.height * c.height / sc }; this.close(); };
    const mobsHere = [...new Set(W.map.mobs.map(m => m[0]))].map(id => G.data.mobs[id]).filter(Boolean).sort((a, b) => a.lv - b.lv);
    body.append(c, h('div', { class: 'req', style: 'margin-top:6px' }, 'Chạm vào bản đồ để tự đi tới. Vàng = bạn, cam = NPC, đỏ = quái.'));
    if (mobsHere.length) body.append(h('div', { class: 'req' }, 'Quái ở đây: ' + mobsHere.map(m => `${m.name} (Lv${m.lv})`).join(', ')));
  },

  wSys(body, title) {
    title.textContent = 'Hệ thống';
    const P = W.P;
    const list = h('div', { class: 'list' });
    const btn = (t, sub, f) => list.append(h('div', { class: 'li', onclick: f }, h('div', { class: 'grow' }, h('b', {}, t), h('br'), h('small', {}, sub))));
    btn('Lưu game', 'Lưu vào trình duyệt này', () => { this.save(); this.toast('Đã lưu'); });
    if (Cloud.enabled()) {
      btn('Lưu lên đám mây (Firebase)', Cloud.user() ? 'Tài khoản: ' + (Cloud.user().email || Cloud.user().uid) : 'Cần đăng nhập Google', async () => {
        try { await Cloud.save(P); this.toast('Đã lưu lên đám mây'); } catch (e) { this.toast('Lỗi: ' + e.message); }
      });
    } else btn('Lưu đám mây (chưa bật)', 'Điền cấu hình Firebase trong js/config.js để bật', () => {});
    btn('Xuất file lưu (.json)', 'Tải file để sao lưu / chuyển máy', () => exportSave(P));
    btn('Về làng', 'Quay về Sơn Nam', () => { this.close(); enterMap(P.village || 0, 384, 672); });
    btn('Kẹt? Dịch chuyển về chỗ an toàn', 'Đưa nhân vật ra giữa bản đồ', () => { this.close(); enterMap(W.map.id, 0, 0); });
    btn('Thoát ra màn hình chính', 'Game sẽ được lưu', () => { this.save(); location.reload(); });
    body.append(list, h('div', { class: 'req', style: 'margin-top:8px' },
      'Phím: WASD/mũi tên di chuyển · Space đánh · 1–5 kỹ năng · Q/E bình HP/MP · Z tự động · Enter nói chuyện · I/C/K/M cửa sổ.'));
  },

  // ---------- NPC ----------
  talk(n) {
    W.talkTarget = null;
    const P = W.P;
    const k = n.kind;
    const opts = [];
    const line = NPC_LINES[k] || 'Chào chàng trai trẻ';
    if (k === 0 || k === 1 || k === 26) opts.push(['Mua thuốc', () => this.open('shop', { name: 'POTION', title: n.name })]);
    if (k === 3) { opts.push(['Mua trang phục', () => this.open('shop', { name: 'ITEM_EQUIPMENT', title: 'Thiết bì — Trang phục' })]); opts.push(['Mua vũ khí', () => this.open('shop', { name: 'WEAPON', title: 'Thiết bì — Vũ khí' })]); opts.push(['Sửa đồ', () => this.open('repair')]); }
    if (k === 27) opts.push(['Mua giáp', () => this.open('shop', { name: 'GIAP_SU', title: 'Giáp sư' })]);
    if (k === 28) opts.push(['Mua vũ khí', () => this.open('shop', { name: 'KIEM_SU', title: 'Kiếm sư' })]);
    if (k === 24) opts.push(['Mua trang sức', () => this.open('shop', { name: 'BAO_NGOC', title: 'Bảo ngọc' })]);
    if (k === 7 && W.map.xaPhu >= 0) opts.push(['Đi xe', () => this.open('travel')]);
    if (k === 7 || k === -23) opts.push(['Đi xa (mọi vùng đã biết)', () => this.open('travel', { all: true })]);
    if (k === 5) {
      const Q = P.quest;
      if (!Q) opts.push(['Nhận nhiệm vụ', () => { P.quest = makeQuest(P); this.refreshQuest(); const m = G.data.mobs[P.quest.mob];
        this.say(n, `Hãy đi tiêu diệt ${P.quest.need} con ${m.name} (cấp ${m.lv}) ở ${P.quest.where}, sau đó quay về nói chuyện với ta.`); }]);
      else if (Q.have >= Q.need) opts.push(['Trả nhiệm vụ', () => { const r = questReward(P); P.quest = null; P.questDone = (P.questDone || 0) + 1;
        P.xu += r.xu; P.potions[1] = (P.potions[1] || 0) + r.pot; W.ui.refreshQuest(); gainExp(r.exp);
        this.say(n, `Giỏi lắm! Thưởng cho con ${fmt(r.exp)} kinh nghiệm, ${fmt(r.xu)} xu và ${r.pot} bình HP nhỏ.`); this.refreshHud(); }]);
      else opts.push(['Huỷ nhiệm vụ hiện tại', () => { P.quest = null; this.refreshQuest(); this.toast('Đã huỷ nhiệm vụ'); }]);
      opts.push(['Học kỹ năng mới', () => this.open('learn')]); opts.push(['Gợi ý luyện cấp', () => this.say(n, hint(P))]);
    }
    if (k === 8) opts.push(['Nghe ông nội nói', () => this.intro()]);
    if (k === 4) opts.push(['Hỏi đường', () => this.say(n, hint(P))]);
    opts.push(['Tạm biệt', () => this.dialog(null)]);
    this.dialog(n.name, line, opts);
  },
  say(n, s) { this.dialog(n.name, s, [['Đóng', () => this.dialog(null)]]); },
  dialog(name, text, opts) {
    const d = $('#dialog');
    if (!name) { d.classList.add('hidden'); return; }
    d.classList.remove('hidden');
    $('#dlg-name').textContent = name; $('#dlg-text').textContent = text;
    const o = $('#dlg-opts'); o.innerHTML = '';
    for (const [t, f] of opts) o.append(h('button', { onclick: () => { d.classList.add('hidden'); f(); } }, t));
  },
  intro() {
    let i = 0;
    const next = () => {
      if (i < INTRO.length) { const s = INTRO.slice(i, i + 3).join('\n'); i += 3; this.dialog('Ông nội', s, [['Tiếp tục', next]]); }
      else this.dialog('Ông nội', 'Uhm, chúc con lên đường bình an.', [['Vâng! thưa nội con đi', () => { W.P.intro = true; enterMap(0, 384, 672); this.toast('Làng Sơn Nam'); this.save(true); }]]);
    };
    next();
  },
  onDeath() {
    const P = W.P, cost = Math.max(1000, Math.round(Math.pow(P.level, Math.floor(P.level / 10))));
    const opts = [['Về làng hồi sinh (miễn phí)', () => revive(false)]];
    if (P.level < 10) opts.unshift(['Hồi sinh tại chỗ (miễn phí dưới cấp 10)', () => revive(true)]);
    else opts.unshift([`Hồi sinh tại chỗ (${fmt(cost)} xu)`, () => { if (P.xu < cost) { this.toast('Không đủ xu'); return this.onDeath(); } P.xu -= cost; revive(true); }]);
    this.dialog('Bạn đã bị đánh bại', 'Hãy cẩn thận hơn với những con quái mạnh.', opts);
  },

  wShop(body, title, arg) {
    this._arg = arg;
    title.textContent = arg.title || 'Cửa hàng';
    const P = W.P;
    const shop = G.data.shops[arg.name];
    body.append(h('div', { class: 'req', style: 'color:#ffe28a;margin-bottom:6px' }, `Xu: ${fmt(P.xu)}`));
    const list = h('div', { class: 'list' });
    if (shop.type === 0) {
      for (const id of shop.items) {
        const t = G.data.potions[id]; if (!t) continue;
        for (const q of [1, 10, 50]) {
          const price = t.price * q;
          list.append(h('div', { class: 'li' + (P.xu < price ? ' dis' : ''), onclick: () => {
            if (P.xu < price) return this.toast('Không đủ xu');
            P.xu -= price; P.potions[id] = (P.potions[id] || 0) + q; this.refreshHud(); this.toast(`Đã mua ${q} ${t.name}`); this.reopen();
          } }, iconCanvas('potion', id), h('div', { class: 'grow' }, h('b', {}, `${t.name} x${q}`), h('br'), h('small', {}, t.desc.split('\n').slice(1).join(' ') || `Đang có: ${P.potions[id] || 0}`)), h('span', { class: 'price' }, fmt(price) + ' xu')));
        }
      }
    } else {
      const its = shop.items.map(i => G.data.items[i]).filter(t => t && (t.gender === 0 || t.gender === P.gender) && (t.cls < 0 || t.cls === P.cls) && St.slotOf(t) >= 0 && t.type !== 13)
        .sort((a, b) => a.lv - b.lv || a.type - b.type);
      for (const t of its) {
        const ok = P.level >= t.lv;
        const e = St.newEquip(t.id, P.cls);
        list.append(h('div', { class: 'li' + (P.xu < t.price ? ' dis' : ''), onclick: () => {
          if (P.xu < t.price) return this.toast('Không đủ xu');
          if (P.bag.length >= P.bagMax) return this.toast('Hành trang đầy');
          P.xu -= t.price; P.bag.push(St.newEquip(t.id, P.cls)); this.refreshHud(); this.toast('Đã mua ' + t.name); this.reopen();
        } }, iconCanvas('equip', t.id), h('div', { class: 'grow' }, h('b', { style: ok ? '' : 'color:#ff8a7a' }, t.name), h('br'),
          h('small', {}, `Cấp ${t.lv} · ` + e.att.map(([a, v]) => `${(G.data.attrs[a] || {}).name || ATT_NAMES[a]} +${v}`).join(', '))), h('span', { class: 'price' }, fmt(t.price) + ' xu')));
      }
    }
    body.append(list);
  },
  wRepair(body, title) {
    title.textContent = 'Sửa đồ';
    const P = W.P;
    const its = Object.values(P.body).filter(it => it && it.mdur && it.dur < it.mdur);
    const cost = its.reduce((s, it) => s + Math.ceil((it.mdur - it.dur) * G.data.items[it.id].price / it.mdur / 3), 0);
    body.append(h('p', {}, its.length ? `Sửa ${its.length} món đồ đang mặc: ${fmt(cost)} xu` : 'Đồ đang mặc không cần sửa.'));
    if (its.length) body.append(h('button', { onclick: () => {
      if (P.xu < cost) return this.toast('Không đủ xu');
      P.xu -= cost; its.forEach(it => it.dur = it.mdur); recalc(); this.toast('Đã sửa xong'); this.close();
    } }, 'Sửa tất cả'));
  },
  wTravel(body, title, arg = {}) {
    title.textContent = 'Xa phu';
    const P = W.P;
    const list = h('div', { class: 'list' });
    const add = (mid, x, y, price) => {
      const m = G.data.maps[mid]; if (!m) return;
      list.append(h('div', { class: 'li' + (P.xu < price ? ' dis' : ''), onclick: () => {
        if (P.xu < price) return this.toast('Không đủ xu');
        P.xu -= price; this.close(); enterMap(mid, x * 16 + 8, y * 16 + 8); this.refreshHud();
      } }, h('div', { class: 'grow' }, h('b', {}, m.name || ('Bản đồ ' + mid)), h('br'), h('small', {}, levelRange(mid))), h('span', { class: 'price' }, fmt(price) + ' xu')));
    };
    if (!arg.all && W.map.xaPhu >= 0) {
      const xp = G.data.xaphu[W.map.xaPhu];
      if (xp) xp.maps.forEach((mid, i) => add(mid, xp.x[i], xp.y[i], xp.price[i]));
    } else {
      const mapsList = Object.values(G.data.maps).filter(m => !m.offline && m.name && m.id !== W.map.id).sort((a, b) => minLv(a) - minLv(b));
      for (const m of mapsList) add(m.id, 0, 0, Math.max(200, minLv(m) * 60));
    }
    body.append(list);
  },
  wLearn(body, title) {
    title.textContent = 'Học kỹ năng mới';
    const P = W.P;
    const list = h('div', { class: 'list' });
    for (const s of G.data.skillNew.filter(s => s.cls === P.cls)) {
      const req = St.skillReqLv(s.skill, 1);
      const learned = P.skills[s.skill] >= 0;
      list.append(h('div', { class: 'li' + (learned ? ' dis' : '') }, iconCanvas('skill', [P.cls, s.skill], 20),
        h('div', { class: 'grow' }, h('b', {}, s.name), h('br'), h('small', {}, s.desc), h('br'), h('small', {}, `Yêu cầu cấp ${req}`)),
        learned ? h('span', {}, 'Đã học') : h('button', { onclick: () => {
          if (P.level < req) return this.toast(`Yêu cầu cấp ${req}`);
          if (P.xu < s.price) return this.toast('Không đủ xu');
          P.xu -= s.price; P.skills[s.skill] = 0; this.toast('Học thành công ' + s.name + ' — dùng điểm kỹ năng để nâng cấp'); this.refreshHud(); this.open('learn');
        } }, fmt(s.price) + ' xu')));
    }
    body.append(list);
  },

  // ---------- Lưu ----------
  save(silent) {
    if (!W.P) return;
    const P = W.P;
    P.x = Math.round(W.player.x); P.y = Math.round(W.player.y); P.map = W.map ? W.map.id : P.map;
    if (W.map && W.map.offline && W.map.id !== 105 && P.back) { P.map = P.back.map; P.x = P.back.x; P.y = P.back.y + 18; }
    P.savedAt = Date.now();
    const clean = { ...P }; delete clean._buffs;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(clean)); } catch (e) { silent || this.toast('Không lưu được: ' + e.message); }
    if (Cloud.enabled() && Cloud.user() && silent) Cloud.save(clean).catch(() => {});
  },
};

function canWear(t) {
  const P = W.P;
  return t.lv <= P.level && (t.cls < 0 || t.cls === P.cls) && (!t.gender || t.gender === P.gender) && St.slotOf(t) >= 0 &&
    !(t.type >= 3 && t.type <= 7 && t.type !== 3 + P.cls);
}
function sellPrice(it) { return Math.floor((G.data.items[it.id].price || 0) / 2); }
function minLv(m) { const l = m.mobs.map(x => (G.data.mobs[x[0]] || {}).lv || 99).filter(x => x < 99); return l.length ? Math.min(...l) : 0; }
function levelRange(mid) {
  const m = G.data.maps[mid]; const l = m.mobs.map(x => (G.data.mobs[x[0]] || {}).lv).filter(Boolean);
  return l.length ? `Quái cấp ${Math.min(...l)}–${Math.max(...l)}` : 'Không có quái';
}
function hint(P) {
  const maps = Object.values(G.data.maps).filter(m => !m.offline && m.mobs.length);
  let best = null, bd = 1e9;
  for (const m of maps) { const lo = minLv(m); const d = Math.abs(lo - P.level + 1); if (lo <= P.level + 1 && d < bd) { bd = d; best = m; } }
  return best ? `Với sức của con (cấp ${P.level}), hãy đến ${best.name} — ${levelRange(best.id)}. Nhớ mua đủ bình HP ở Dì út nhé!` : 'Hãy luyện tập quanh làng trước đã.';
}
function exportSave(P) {
  const blob = new Blob([JSON.stringify(P)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kpah_${P.name}_lv${P.level}.json`; a.click();
}

function makeQuest(P) {
  const seen = new Map();
  for (const m of Object.values(G.data.maps)) {
    if (m.offline) continue;
    for (const [id] of m.mobs) { const t = G.data.mobs[id]; if (!t || (id >= 36 && id <= 46) || (id >= 85 && id <= 89) || t.kind !== 'strip') continue;
      if (!seen.has(id)) seen.set(id, m.name); }
  }
  const cands = [...seen.keys()].map(id => G.data.mobs[id]);
  let pool = cands.filter(t => t.lv >= P.level - 2 && t.lv <= P.level + 1);
  if (!pool.length) pool = cands.sort((a, b) => Math.abs(a.lv - P.level) - Math.abs(b.lv - P.level)).slice(0, 3);
  const t = pool[Math.floor(Math.random() * pool.length)];
  return { mob: t.id, need: 10 + Math.floor(P.level / 5) * 2, have: 0, where: seen.get(t.id), lv: P.level };
}
function questReward(P) {
  const L = P.quest.lv || P.level;
  return { exp: Math.floor(St.expNeed(L) * 0.25), xu: 300 + L * 200, pot: 5 };
}
