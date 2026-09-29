// ============================================================
// เลือกโหมดที่ต้องการใช้ — uncomment แค่ "API_URL" บรรทัดเดียว
// ที่ตรงกับโหมดที่ต้องการ แล้ว comment ตัวอื่นทั้งหมดไว้
// ============================================================

// ── โหมด 1: Production (build จริงผ่าน IIS ที่ websrv01) หรือจะใช้
//    ชี้ backend production นี้ตอน dev ก็ได้เหมือนกัน (URL เดียวกัน)
//    ⚠️ ถ้าใช้ตอน dev (npm run dev) ต้องเช็ค CORS + WebSocket
//    proxying ฝั่ง IIS ก่อน ไม่งั้น SignalR อาจต่อไม่ติด
const API_URL = 'http://websrv01.dci.daikin.co.jp/ITHelpDeskSystem_API';

// ── โหมด 2: Dev บนเครื่องตัวเอง (ต่อ backend dev บน 10.49.24.4:3005) ──
// const API_URL = 'http://10.49.24.4:3005';

// ── โหมด 3: เผื่อย้อนกลับไปรันแบบ localhost ล้วนๆ (เครื่องเดียว ไม่ผ่าน LAN) ──
// const API_URL = 'http://localhost:3005';


//  const API_URL = import.meta.env.PROD
//   ? `${window.location.origin}/ITHelpDeskSystem_API`
//   : 'http://10.49.24.4:3005';


// ============================================================
// ห้ามแก้ด้านล่างนี้ — ใช้ API_URL ที่เลือกไว้ด้านบนต่อยอดเอง
// ============================================================
const API_BASE = `${API_URL}/api`;

export { API_URL, API_BASE };


// ── เก็บไว้อ้างอิง: config เก่าของระบบ Stock (คนละระบบ ไม่ใช้แล้ว) ──
// const API_URL = 'http://dciweb.dci.daikin.co.jp:3002';
// const API_URL = 'http://localhost:3002';
// const API_BASE = `${API_URL}/ITinventory/api`;
// export { API_URL, API_BASE };