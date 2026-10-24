# Khí Phách Anh Hùng — bản web chơi đơn (offline)

Làm lại game **Khí Phách Anh Hùng (KPAH)** chạy thẳng trên trình duyệt, **không cần máy chủ**.
Toàn bộ bản đồ, quái, vật phẩm, trang phục, kỹ năng và công thức chỉ số được lấy từ source gốc
(server Java + file `kpah.sql` + client Unity `KPAH_225`).

## Có gì trong game

- 57 bản đồ gốc (Sơn Nam, Dao Châu, Tiên du, Phù liệt… Thành Trấn Danh, hang động, nhà trong làng), có va chạm địa hình, cây, mái nhà, cổng chuyển map.
- 131 loại quái với ảnh gốc (đã giải mã), AI đi lang thang / đuổi đánh, hồi sinh sau 8 giây.
- 5 môn phái: Kiếm khách, Chiến binh, Pháp sư, Đấu sĩ, Cung thủ, mỗi phái có 9–11 kỹ năng với số liệu gốc (sát thương %, MP, hồi chiêu, tầm đánh, cấp yêu cầu).
- Nhân vật ghép từng bộ phận (tóc, áo, quần, nón, vũ khí): mặc đồ gì thì nhân vật hiện đúng đồ đó.
- Công thức chỉ số, sát thương, EXP, lên cấp, rơi đồ: chuyển từ `Point.java`, `Monster.java`, `SkillService.java`.
- 755 trang bị và 160 loại thuốc; cửa hàng NPC (Dì út HP, Bà tám, Thiết bì, Giáp sư, Kiếm sư, Bảo ngọc), sửa đồ, Xa phu đi xe.
- Cộng điểm tiềm năng, điểm kỹ năng, học kỹ năng mới ở Trưởng làng; nhiệm vụ diệt quái lặp lại.
- Tự động đánh (AUTO): tự tìm quái tới được, tự dùng kỹ năng, tự uống thuốc, tự nhặt đồ.
- Mở đầu bằng lời dặn của Ông nội như bản gốc.
- Điều khiển bằng bàn phím, chuột, hoặc cảm ứng (joystick) trên điện thoại.
- Lưu tự động vào trình duyệt; xuất/nhập file lưu; lưu đám mây Firebase (tuỳ chọn).

## Chạy thử trên máy

Game dùng ES module nên cần mở qua web server (không mở trực tiếp file `index.html`):

```bash
cd kpah-web
python3 -m http.server 8000
# mở http://localhost:8000
```

## Đưa lên GitHub Pages

1. Tạo repo mới trên GitHub (ví dụ `kpah-web`), đẩy toàn bộ thư mục này lên:
   ```bash
   git init
   git add .
   git commit -m "KPAH web offline"
   git branch -M main
   git remote add origin https://github.com/<tên-bạn>/kpah-web.git
   git push -u origin main
   ```
2. Vào **Settings → Pages**, chọn *Deploy from a branch*, branch `main`, thư mục `/ (root)` → Save.
3. Sau 1–2 phút game chạy tại `https://<tên-bạn>.github.io/kpah-web/`.

Lưu ý: repo công khai thì ai cũng tải được ảnh và dữ liệu game. Nếu muốn giữ riêng, dùng repo private
(GitHub Pages cho repo private cần gói trả phí) hoặc dùng Firebase Hosting bên dưới.

## Bật lưu đám mây bằng Firebase (tuỳ chọn)

Không bật thì game vẫn lưu trong trình duyệt bình thường. Bật để chơi tiếp trên máy khác:

1. Vào https://console.firebase.google.com → tạo project.
2. **Build → Authentication → Sign-in method** → bật **Google**.
   Ở tab **Settings → Authorized domains** thêm `<tên-bạn>.github.io`.
3. **Build → Firestore Database** → Create database. Vào tab **Rules**, dán nội dung file `firestore.rules` → Publish.
4. **Project settings → Your apps → Web app (</>)** → copy đoạn `firebaseConfig` rồi dán vào `FIREBASE_CONFIG` trong `js/config.js`.
5. Đẩy lại lên GitHub. Trong game: **Hệ thống → Lưu lên đám mây**; ở màn hình đầu có nút **Tải từ đám mây**.
   Khi đã đăng nhập, game tự đồng bộ lên đám mây mỗi lần tự lưu.

### Hoặc host luôn bằng Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # chọn project của bạn
firebase deploy             # dùng sẵn firebase.json trong thư mục
```

## Tuỳ chỉnh

`js/config.js`:

| Tham số | Ý nghĩa |
|---|---|
| `EXP_RATE` | Hệ số kinh nghiệm (bản gốc = 1, mặc định 2) |
| `DROP_RATE` | Hệ số rơi đồ (bản gốc = 1, mặc định 4) |
| `XU_RATE` | Hệ số xu rơi ra |
| `MOB_RESPAWN_MS` | Thời gian quái hồi sinh |
| `SCALE` | Độ phóng to điểm ảnh (0 = tự động) |

Dữ liệu game nằm trong `data/game.json` (bản đồ, quái, vật phẩm, bảng EXP, bảng kỹ năng…), có thể sửa trực tiếp.

## Phím tắt

| Phím | Tác dụng |
|---|---|
| WASD / mũi tên | Di chuyển (hoặc bấm chuột vào bản đồ) |
| Bấm vào quái | Chọn và đánh |
| Space | Đánh mục tiêu gần nhất |
| 1–5 | Kỹ năng trên thanh |
| Q / E | Uống bình HP / MP |
| Z | Bật/tắt tự động đánh |
| Enter | Nói chuyện với NPC gần |
| I / C / K / M | Hành trang / Nhân vật / Kỹ năng / Bản đồ |
| Esc | Hệ thống (lưu, xuất file, về làng) |

## Tạo lại dữ liệu từ source gốc

Chỉ cần khi bạn sửa `kpah.sql` hoặc ảnh gốc. Cần Python 3 + Pillow:

```bash
pip install pillow
# giải nén KPAH.rar và KPAH_225.rar trước
python3 tools/rebuild_data.py --server path/KPAH --client path/KPAH_225 --sql path/kpah.sql --out .
```

Script này: đọc SQL → JSON, lấy ảnh tile/hiệu ứng từ `resources.assets` của client Unity,
giải mã ảnh quái (XOR với khoá `NguyenVanMinh`), chép ảnh trang phục/vũ khí/cây/icon, rồi ghi `data/game.json`.

## Cấu trúc

```
index.html, css/style.css
js/main.js     khởi động, màn hình đầu, tạo nhân vật, điều khiển
js/game.js     thế giới, di chuyển, tìm đường, quái, chiến đấu, vẽ
js/stats.js    công thức chỉ số / sát thương / EXP (chuyển từ server Java)
js/render.js   vẽ nhân vật ghép, quái, bản đồ, icon
js/ui.js       HUD, hành trang, cửa hàng, kỹ năng, hội thoại, lưu game
js/cloud.js    lưu đám mây Firebase
js/data.js     tải dữ liệu, tên môn phái / kỹ năng / NPC
data/game.json dữ liệu game
img/           ảnh (tile, quái, trang phục, vũ khí, cây, icon, hiệu ứng)
tools/         script tạo lại dữ liệu
```

## Chưa có so với bản gốc

Các tính năng chỉ có ý nghĩa khi chơi nhiều người (bang hội, party, giao dịch, PK, chợ, đấu trường),
cùng thú cưỡi/thú nuôi, trồng cây, hợp thành/ép đồ và rương gửi đồ, chưa được làm.
Ảnh NPC gốc không có trong source nên NPC được vẽ bằng hệ trang phục của game.
