// Lưu đám mây bằng Firebase (tuỳ chọn). Chỉ tải SDK khi đã điền FIREBASE_CONFIG.
import { FIREBASE_CONFIG } from './config.js';

const V = '10.12.2';
let fb = null, _user = null;

async function init() {
  if (fb) return fb;
  const [{ initializeApp }, auth, store] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  const a = auth.getAuth(app);
  const db = store.getFirestore(app);
  fb = { auth, store, a, db };
  await new Promise(res => auth.onAuthStateChanged(a, u => { _user = u; res(); }));
  return fb;
}
async function login() {
  const f = await init();
  if (_user) return _user;
  const r = await f.auth.signInWithPopup(f.a, new f.auth.GoogleAuthProvider());
  _user = r.user; return _user;
}

export const Cloud = {
  enabled: () => !!FIREBASE_CONFIG.apiKey,
  user: () => _user,
  async warm() { if (this.enabled()) try { await init(); } catch (e) { console.warn('Firebase', e); } },
  async save(P) {
    const f = await init(); const u = await login();
    const clean = JSON.parse(JSON.stringify(P)); delete clean._buffs;
    await f.store.setDoc(f.store.doc(f.db, 'saves', u.uid), { data: JSON.stringify(clean), name: P.name, level: P.level, updated: Date.now() });
  },
  async load() {
    const f = await init(); const u = await login();
    const s = await f.store.getDoc(f.store.doc(f.db, 'saves', u.uid));
    return s.exists() ? JSON.parse(s.data().data) : null;
  },
};
