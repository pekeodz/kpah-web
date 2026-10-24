// Chỉ số nhân vật — chuyển từ player/Point.java của server gốc
import { G } from './data.js';

export const K = { KIEM_KHACH: 0, CHIEN_BINH: 1, PHAP_SU: 2, DAU_SI: 3, CUNG_THU: 4 };
export const PERCENT_ATTRIBUTE = [20, 50, 10, 70, 20];
export const ATTRIBUTE_FOR_TYPE = [
  [0, 1, 1, 1, 0, 0, 1], [0, 1, 1, 1, 0, 0, 1], [0, 1, 1, 1, 0, 0, 1], [1, 0, 0, 1, 1, 0, 0], [1, 0, 0, 1, 1, 0, 0],
  [1, 0, 0, 1, 1, 0, 0], [1, 0, 0, 1, 1, 0, 0], [1, 0, 0, 1, 1, 0, 0], [1, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 1, 0, 0],
  [0, 1, 1, 0, 0, 0, 1], [0, 1, 0, 1, 1, 0, 1], [0, 0, 0, 1, 1, 1, 0], [1, 0, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0], [0, 1, 0, 0, 0, 0, 1], [1, 0, 0, 0, 1, 0, 0], [0, 1, 0, 0, 0, 0, 1], [0, 1, 0, 0, 0, 0, 1],
];

export const O = () => G.data.others;
export const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const chance = (p, of = 100) => Math.random() * of < p;

export function skillPct(cls, type, lv) { return lv > 0 ? O().SKILL_DAM_PERCENT[cls][type][lv] : 0; }
export function skillMP(cls, type, lv) { return lv > 0 ? O().SKILL_MP[cls][type][lv] : 0; }
export function skillCD(cls, type, lv) { return lv > 0 ? O().SKILL_COOLDOWN[cls][type][lv] : 0; }
export function skillRange(cls, type) { return O().SKILL_RANGE[cls][type]; }
export function skillReqLv(type, lv) { return lv >= 0 ? O().LEVEL_ADD_SKILL[type][Math.min(lv, 10)] : 0; }
export function isAoe(cls, type) { return O().SKILL_AEO[cls].includes(type); }
export function buffTime(type, lv) { return lv > 0 ? O().TIME_LIFE_BUFF_SKILL[type][lv] : 0; }

// EXP để lên cấp tiếp theo (Util.getExp: tổng exps[0..level-1])
export function expNeed(level) {
  const e = O().EXP; let s = 0;
  for (let i = 0; i < level && i < e.length; i++) s += e[i];
  if (level > e.length) s += (level - e.length) * e[e.length - 1];
  return s;
}

// Tạo vật phẩm trang bị (ItemService.createNewItemEquipment)
export function newEquip(id, cls) {
  const t = G.data.items[id]; if (!t) return null;
  if (t.cls !== -1) cls = t.cls;
  const att = [];
  const a = t.att || [];
  if (a[0] > 0) att.push([0, a[0]]);
  const allow = ATTRIBUTE_FOR_TYPE[t.type] || [];
  for (let i = 1; i < 7; i++) {
    const v = Math.floor((a[i] || 0) + (t.type < 14 ? (a[i] || 0) * PERCENT_ATTRIBUTE[Math.max(0, cls)] / 100 : 0));
    if (v > 0 && allow[i]) att.push([i, v]);
  }
  return { id, cls, att, dur: t.dur, mdur: t.dur, plus: 0 };
}
export function itemValue(it, attId) {
  let s = 0; for (const [a, v] of it.att) if (a === attId) s += v; return s;
}
export function slotOf(t) {
  if (t.type >= 3 && t.type <= 7) return 3;
  if ([0, 1, 2, 8, 9, 10, 11, 12, 13, 19].includes(t.type)) return t.type === 13 ? 13 : t.type;
  return -1;
}

export function calcStats(P) {
  const S = { };
  const cls = P.cls;
  const body = Object.values(P.body || {}).filter(Boolean);
  const sum = (id) => body.reduce((s, it) => s + (it.dur > 0 || it.mdur === 0 ? itemValue(it, id) : 0), 0);
  const lv = P.skills;
  const buffs = P._buffs || {};
  const pt = P.pts;
  const strA = sum(10) + sum(35), agiA = sum(11) + sum(36), hea = sum(13) + sum(5) + sum(38);
  let spiA = sum(12) + sum(37);
  if (cls === K.PHAP_SU) spiA += Math.floor(spiA * Math.floor(skillPct(cls, 5, lv[5]) / 100));
  const STR = pt.str + strA, AGI = pt.agi + agiA, SPI = pt.spi + spiA, HEA = pt.hea + hea, LUCK = pt.luck;
  S.STR = STR; S.AGI = AGI; S.SPI = SPI; S.HEA = HEA; S.LUCK = LUCK;
  // HP/MP
  let hpMax = HEA * (cls === K.KIEM_KHACH ? 80 : (cls === K.DAU_SI || cls === K.CHIEN_BINH) ? 70 : 60);
  let pctHp = 0, pctMp = 0;
  if (buffs.hpmp) { pctHp = buffs.hpmp.pct; pctMp = buffs.hpmp.pct; }
  hpMax += Math.floor(hpMax * pctHp / 100) + sum(33);
  let mpMax = SPI * (cls === K.PHAP_SU ? 52 : 20);
  mpMax += Math.floor(mpMax * pctMp / 100) + sum(34);
  // attack
  let atk = 0;
  if (cls === K.PHAP_SU) atk = SPI * 2; else if (cls === K.CUNG_THU) atk = Math.floor(AGI * 1.8); else atk = STR;
  atk += sum(0);
  if (cls === K.CHIEN_BINH) atk += Math.floor(atk * Math.floor(skillPct(cls, 5, lv[5]) / 100));
  if (buffs.atk) atk += Math.floor(atk * buffs.atk.pct / 100);
  let def = AGI + sum(1), mdef = AGI + sum(6);
  if (cls === K.DAU_SI) { const p = Math.floor(skillPct(cls, 5, lv[5]) / 100); def += def * p; mdef += mdef * p; }
  if (buffs.def) { def += Math.floor(def * buffs.def.pct / 100); mdef += Math.floor(mdef * buffs.def.pct / 100); }
  let acc = sum(3) + (cls === K.CUNG_THU ? AGI : 0);
  let dodge = sum(2) + (cls === K.CUNG_THU ? Math.floor(AGI * 0.5) : 0);
  let crit = Math.floor(LUCK / 20) + Math.floor(sum(4) / 2);
  let xuyen = sum(31) + (cls === K.KIEM_KHACH ? skillPct(cls, 4, lv[4]) : 0);
  let docTinh = sum(16) + (cls === K.CUNG_THU ? skillPct(cls, 5, lv[5]) : 0);
  Object.assign(S, { hpMax: Math.max(1, hpMax), mpMax: Math.max(1, mpMax), atk, def, mdef, acc, dodge, crit,
    baoKich: sum(27), x2: sum(26), hapThu: sum(81), giamVat: sum(28), giamMa: sum(29), xuyen, docTinh, expDonate: sum(111), speed: 5 });
  return S;
}

// Sát thương người chơi (Point.getDameAttack)
export function playerDamage(P, S, type, crit) {
  let d = Math.floor(S.atk * 2.5);
  d += d * Math.floor(skillPct(P.cls, type, P.skills[type]) / 100);
  if (crit) d *= 2;
  d = rnd(Math.floor(d * 0.7), Math.floor(d * 0.9));
  return Math.max(1, d);
}
// Monster.injured
export function mobInjured(mob, P, dmg, xuyen) {
  const t = mob.t;
  if (!mob.ore) {
    if (t.lv - 2 > P.level) dmg = Math.floor(dmg / (t.lv - P.level + 2));
    if (!xuyen) dmg -= Math.floor(t.hp * 0.02);
  }
  return Math.max(0, dmg);
}
// Monster.getDameAttack + Player.injured
export function mobDamage(mob, P, S) {
  const d0 = mob.t.hp * 0.2;
  let d = rnd(Math.floor(d0 * 0.9), Math.floor(d0 * 1.2));
  if (d <= 0) d = 1;
  if (mob.t.lv - 2 < P.level) d = Math.floor(d / (P.level - mob.t.lv + 2));
  d -= S.def;
  if (chance(S.hapThu)) d -= Math.floor(d * S.hapThu / 100);
  d -= Math.floor(d * S.giamVat / 100);
  if (chance(Math.min(60, S.dodge))) return 0;
  return Math.max(1, d);
}
// Monster.calculatePowerPlus — EXP nhận được
export function expGain(mob, P, S, dmg) {
  let a = Math.floor(P.level / 20) || 1;
  const b = dmg * a;
  const c = (mob.t.lv - P.level) * a;
  let tn = Math.floor(b / 2) + Math.floor(b * c / 100);
  tn += Math.floor(tn * Math.floor(S.expDonate / 100));
  const diff = Math.abs(P.level - mob.t.lv);
  if (diff >= 2) tn = Math.floor(tn / (diff + 3));
  if (tn <= 0) tn = 1;
  tn = Math.max(1, Math.floor(tn * (0.6 + Math.random() * 0.3)));
  return tn;
}
