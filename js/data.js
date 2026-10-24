// Tải dữ liệu game và hình ảnh
export const G = { data: null, img: {}, cls: null };

const imgCache = G.img;
export function loadImage(src) {
  if (imgCache[src]) return imgCache[src].promise;
  const im = new Image();
  const rec = { im, ok: false };
  rec.promise = new Promise((res) => {
    im.onload = () => { rec.ok = true; res(im); };
    im.onerror = () => { rec.ok = false; res(null); };
  });
  im.src = src;
  imgCache[src] = rec;
  return rec.promise;
}
// Lấy ảnh nếu đã tải xong, nếu chưa thì bắt đầu tải và trả null
export function img(src) {
  const r = imgCache[src];
  if (r) return r.ok ? r.im : null;
  loadImage(src);
  return null;
}

export async function loadAll(onProgress) {
  const res = await fetch('data/game.json');
  const total = +res.headers.get('content-length') || 1100000;
  const reader = res.body.getReader();
  let got = 0; const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    onProgress && onProgress(Math.min(0.9, got / total * 0.9));
  }
  const buf = new Uint8Array(got); let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.length; }
  G.data = JSON.parse(new TextDecoder().decode(buf));
  const pre = ['img/tiles/t.png', 'img/tiles/t_hang.png', 'img/tiles/t_thanh.png', 'img/icon/items.png', 'img/icon/potion.png',
    'img/ui/shadow.png', ...[0, 1, 2, 3, 4].map(c => `img/skill/${c}.png`)];
  let n = 0;
  await Promise.all(pre.map(p => loadImage(p).then(() => { n++; onProgress && onProgress(0.9 + 0.1 * n / pre.length); })));
  return G.data;
}

// ---- Thông tin lớp nhân vật / kỹ năng (từ client gốc)
export const CLASSES = [
  { name: 'Kiếm khách', he: 'Kim', wtype: 3, weapon: 79, desc: 'Dùng kiếm. Máu cao, sức tấn công ổn định, kỹ năng hệ Lôi.',
    skills: ['Chém', 'Kim tinh pháp', 'Lôi điện pháp', 'Kinh lôi bát thủ', 'Hộ sát tiến', 'Dĩ lực đáo công', 'Thiên lôi điện trảm', 'Sấm động dương gian', 'Kiếm phi kinh thiên'] },
  { name: 'Chiến binh', he: 'Hỏa', wtype: 4, weapon: 86, desc: 'Dùng đao. Sức mạnh lớn nhất, kỹ năng hệ Hỏa.',
    skills: ['Chém', 'Hỏa kinh thiên', 'Nhất hỏa long', 'Bát đại hỏa long', 'Cường thân giáp', 'Hộ công tiến', 'Thiên long bạo kích', 'Liệt hỏa bạo kích', 'Sao băng giáng thế'] },
  { name: 'Pháp sư', he: 'Thủy', wtype: 5, weapon: 93, desc: 'Dùng bút. Tấn công từ xa bằng phép, MP dồi dào.',
    skills: ['Đánh', 'Thủy giáng minh', 'Thần long thủy', 'Bát đại hải long', 'Hồi công lực đan', 'Hồi lực tiến', 'Hồi sinh', 'Song hộ công thủ', 'Hải long xuất thế', 'Song long thị uy', 'Hàn băng vũ'] },
  { name: 'Đấu sĩ', he: 'Thổ', wtype: 6, weapon: 100, desc: 'Dùng búa. Phòng thủ chắc chắn, kỹ năng hệ Thổ.',
    skills: ['Đập', 'Thổ Tú', 'Kim sơn thủy', 'Khổng kình bát vĩ', 'Bất di biến', 'Hộ thủ tiến', 'Kinh thiên động địa', 'Sơn Tinh bộ thiên', 'Thạch nhũ công tâm'] },
  { name: 'Cung thủ', he: 'Mộc', wtype: 7, weapon: 107, desc: 'Dùng cung. Bắn xa, né tránh và chính xác cao.',
    skills: ['Bắn', 'Nhất hồn tiễn', 'Phi thiên tiễn', 'Bát kim tễn đáo', 'Độc lưu tiễn', 'Hộ độc tiễn', 'Thập diện tâm tiễn', 'Thăng thiên loạn tiễn', 'Vạn tiễn quy tâm'] },
];
// Hiệu ứng (fx id từ client) cho từng kỹ năng
export const SKILL_FX = [
  { 1: 60, 2: 59, 3: 45, 6: 59, 7: 49, 8: 48 },
  { 1: 54, 2: 52, 3: 62, 6: 61, 7: 71, 8: 55 },
  { 0: 47, 1: 56, 2: 42, 3: 50, 8: 58, 9: 57, 10: 65 },
  { 1: 66, 2: 53, 3: 64, 6: 66, 7: 63, 8: 57 },
  { 0: 48, 1: 48, 2: 47, 3: 44, 6: 46, 7: 43, 8: 51 },
];
// Kỹ năng hỗ trợ (không gây sát thương) — dùng làm buff tạm thời
export const BUFF_SKILLS = [[4, 5], [4, 5], [4, 5, 6, 7], [4, 5], [4, 5]];

export const NPC_NAMES = ['Dì út HP', 'Bà tám tạp hóa', 'Hắc ngưu', 'Thiết bì', 'Lính gác', 'Trưởng làng', 'Phú ông', 'Xa phu', 'Ông nội', 'Anh bảy',
  'Hoa tiêu', 'Nhất giáp', 'Nhị giáp', 'Tam giáp', 'Tứ giáp', 'Ngũ giáp', 'Nhất ngưu', 'Nhị ngưu', 'Tam ngưu', 'Tứ ngưu', 'Ngũ ngưu',
  'Lâm tướng quân', 'Nhật thương nhân', 'Hỏa xích', 'Bảo ngọc', 'Trần thống lĩnh', 'Kim hoa', 'Giáp Sư', 'Kiếm Sư', 'Bội Châu', 'An Tâm', 'Lộc Phát'];
export const NPC_LINES = {
  0: 'Vào trong đi cậu. Đủ loại HP từ lớn đến bé!', 1: 'Hò ơ… mua gì cũng có, hỏi gì cũng biết', 2: 'Mua gì đây, nói ta nghe',
  3: 'Vũ khí ở đây rất lợi hại, vào trong tôi cho cậu xem!', 4: 'Trách nhiệm của ta là bảo vệ ngôi làng này.',
  5: 'Con là thành viên của làng Nghĩa Sĩ này ! Hãy nhớ lấy điều đó', 6: 'Muốn mua ngọc thì vào nhà', 7: 'Đường xa vạn lý, không làm nản lòng xa phu ta đây',
  9: 'Gửi đồ chỗ ta là an toàn nhất đó', 10: 'Đi lâu thành lối, lối thành đường đi.', 21: 'Anh hùng xuất thiếu niên..anh hùng xuất thiếu niên',
  25: 'Cố gắng lên con, hãy hoàn thành các nhiệm vụ đi nhé', 26: 'Gánh hàng nhỏ nhưng món gì cũng có đây', 27: 'Mua giáp của ta, ngươi sẽ luôn được bảo vệ an toàn',
  28: 'Vũ khí ở đây rất lợi hại!', 24: 'Ngươi muốn mua vật phẩm để luyện đồ?', 30: 'Ngươi muốn nhờ ta giữ đồ?',
};
// Trang phục NPC (áo, quần, nón) và tóc
export const NPC_LOOKS = [[4, 30, 56], [6, 32, 58], [8, 34, 60], [10, 36, 62], [12, 38, 64], [14, 40, 66], [16, 42, 68], [18, 44, 70],
  [20, 46, 72], [22, 48, 74], [24, 50, 76], [26, 52, 78], [269, 293, 317], [273, 297, 321], [277, 301, 325], [281, 305, 329], [285, 309, 333], [289, 313, 337]];

export const INTRO = [
  'Cháu của ta', 'Nay con đã lớn', 'đã đến lúc con phải được học hỏi nhiều hơn', 'phải trải nghiệm nhiều hơn từ quê hương đất nước',
  'và có nhiều điều để con phải học hỏi nơi biết bao đấng anh hào, ẩn sỹ.', 'Năm xưa ta có người anh em kết nghĩa là Hai Minh',
  'ông ấy giờ đang là trưởng làng của làng này.', 'con hãy đi xuống phương Nam và tìm gặp người này', 'ông ấy sẽ giúp con gia nhập làng nghĩa sỹ Sơn Nam',
  'Con hãy cố gắng để trưởng thành, để có thể giúp được quê hương', 'để có được sự nghiệp riêng và để tìm được nguồn gốc và cha mẹ của con…',
  'Hãy lên đường đi', '..nơi đây ta luôn dõi theo bước chân của con',
];
export const SLOT_NAMES = { 0: 'Áo', 1: 'Quần', 2: 'Nón', 3: 'Vũ khí', 8: 'Nhẫn', 9: 'Dây chuyền', 10: 'Giày', 11: 'Găng', 12: 'Ngọc bội', 19: 'Phi phong' };
export const ATT_NAMES = ['Tấn công', 'Thủ vật', 'Né tránh', 'Chính xác', 'Chí mạng', 'Sức khoẻ', 'Thủ ma'];
