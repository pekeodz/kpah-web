// ====== CẤU HÌNH GAME ======
// Chỉnh các hệ số ở đây cho bản chơi đơn.
export const CONFIG = {
  EXP_RATE: 2,        // nhân kinh nghiệm (bản gốc = 1)
  DROP_RATE: 4,       // nhân tỉ lệ rơi đồ (bản gốc = 1)
  XU_RATE: 2,         // nhân lượng xu rơi
  MOB_RESPAWN_MS: 8000,
  AUTOSAVE_SEC: 20,
  SCALE: 0,           // 0 = tự động theo màn hình; hoặc 2, 3...
  START_XU: 10000,
};

// ====== FIREBASE (tuỳ chọn) ======
// Dán cấu hình web app Firebase của bạn vào đây để bật "Lưu đám mây".
// Firebase Console -> Project settings -> Your apps -> Web app -> Config.
// Để trống (apiKey rỗng) thì game chỉ lưu trong trình duyệt (localStorage).
export const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};
