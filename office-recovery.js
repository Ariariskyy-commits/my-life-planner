/* =====================================================================
   หน้า "ออฟฟิศ" — ออฟฟิศจำลอง + สั่งงาน Agent
   ไฟล์นี้เป็นส่วนเสริม ไม่แก้/ไม่อ่าน state เดิมของแอป
   เก็บข้อมูลใน localStorage ของตัวเองเท่านั้น (key: y2k_office_v1)
   ===================================================================== */
(() => {
    'use strict';

    const LS_KEY = 'y2k_office_v1';
    const W = 400, H = 270, TW = 16, TH = 8, OX = 184, OY = 70;
    const COLS = 10, ROWS = 8, WALL = 44, SPEED = 2.3;
    const INK = '#4A3226', EDGE = 'rgba(74,50,38,.55)';

    const AGENTS = [
        { id: 'brief',    name: 'ปลาทู',     role: 'ถอดโจทย์ให้ชัด',      desk: [1, 1], hair: '#3B2A22', skin: '#F2C9A0', shirt: '#EC5E8B' },
        { id: 'research', name: 'หมูเด้ง',        role: 'หาข้อมูลและแนวทาง',   desk: [4, 1], hair: '#7A4A2A', skin: '#E8B88A', shirt: '#3FA9C9' },
        { id: 'writer',   name: 'น้องเป็ด',            role: 'เขียนเนื้อหา',        desk: [7, 1], hair: '#1F1F2B', skin: '#F2C9A0', shirt: '#FFD36B' },
        { id: 'designer', name: 'แมวส้ม',          role: 'ไอเดียภาพและดีไซน์',  desk: [1, 4], hair: '#B03060', skin: '#F6D3B3', shirt: '#8E5BD6' },
        { id: 'director', name: 'คุณนายไข่ตุ๋น', role: 'ตัดสินใจและรวมงาน',   desk: [4, 4], hair: '#2B2B3A', skin: '#D9A679', shirt: '#F29A4B' },
        { id: 'qc',       name: 'กะปิ',                role: 'ตรวจคุณภาพ',          desk: [7, 4], hair: '#4A3A2A', skin: '#F2C9A0', shirt: '#5BBF7A' }
    ];
    const SPAWNS = [[2, 3], [3, 3], [5, 3], [6, 3], [8, 3], [3, 6]];
    const WANDER = [[8, 1], [5, 1], [7, 6], [7, 7], [3, 3], [6, 3], [3, 6], [2, 7], [8, 5], [1, 3]];
    const MEETING = [[3, 6], [6, 6], [3, 7], [6, 7], [5, 5], [4, 3]];

    const STATE_TH = { idle: 'ว่าง', walking: 'กำลังเดิน', working: 'กำลังทำงาน', thinking: 'กำลังคิด', done: 'เสร็จแล้ว', error: 'มีปัญหา' };
    const STATE_COLOR = { idle: '#9CA3AF', walking: '#3FA9C9', working: '#F29A4B', thinking: '#8E5BD6', done: '#5BBF7A', error: '#EC5E8B' };
    const STATE_ICON = { idle: '', walking: '🚶 ', working: '💻 ', thinking: '💭 ', done: '✅ ', error: '⚠️ ' };
    const TASK_TH = { queued: 'รอคิว', working: 'กำลังทำ', done: 'เสร็จ', error: 'ผิดพลาด', interrupted: 'ถูกขัดจังหวะ' };
    const TASK_CLS = {
        queued: 'bg-gray-200 text-darkText', working: 'bg-sunnyYellow text-darkText',
        done: 'bg-limeGreen text-darkText', error: 'bg-hotPink text-white', interrupted: 'bg-gray-300 text-darkText'
    };

    const $ = id => document.getElementById(id);
    const canvas = $('officeCanvas');
    if (!canvas || !$('tab-office')) return; // ไม่มีหน้านี้ในหน้าเว็บ = ไม่ทำอะไร
    const mainCtx = canvas.getContext('2d');
    mainCtx.imageSmoothingEnabled = false;
    let ctx = mainCtx; // ชั่วคราวชี้ไป canvas พื้นหลังตอนวาดฉากนิ่ง

    /* ---------- ข้อมูลที่เก็บถาวร ---------- */
    const API_URL = 'https://throbbing-salad-5612.tippaporn977.workers.dev/';
    const cfg = { apiUrl: API_URL, tasks: [] };
    function load() {
        try {
            const d = JSON.parse(localStorage.getItem(LS_KEY));
            if (d && typeof d === 'object') {
                cfg.tasks = Array.isArray(d.tasks) ? d.tasks.filter(t => t && AGENTS.some(a => a.id === t.agentId)).slice(0, 60) : [];
            }
        } catch (e) { /* ใช้ค่าเริ่มต้น */ }
        // งานที่ค้างตอนปิดแอป ไม่รันเองอัตโนมัติ (กันเรียก AI โดยไม่ตั้งใจ)
        cfg.tasks.forEach(t => { if (t.status === 'working' || t.status === 'queued') t.status = 'interrupted'; });
    }
    function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch (e) { /* เต็ม/ถูกบล็อก */ } }
    function toast(msg) { if (typeof window.showToast === 'function') window.showToast(msg); }

    /* ---------- แผนผังห้อง + หาทางเดิน (BFS) ---------- */
    const blocked = new Set(['1,1', '4,1', '7,1', '1,4', '4,4', '7,4', '0,0', '1,0', '8,0', '9,0', '0,2', '0,3', '0,5', '0,6', '0,7', '1,6', '1,7', '4,6', '5,6', '4,7', '5,7', '9,3', '9,6', '9,7']);
    const walkable = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && !blocked.has(x + ',' + y);
    function bfs(sx, sy, tx, ty) {
        if (sx === tx && sy === ty) return [];
        const prev = new Map([[sx + ',' + sy, null]]);
        const q = [[sx, sy]];
        while (q.length) {
            const [x, y] = q.shift();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
                if (!walkable(nx, ny) || prev.has(k)) continue;
                prev.set(k, [x, y]);
                if (nx === tx && ny === ty) {
                    const path = [];
                    let c = [nx, ny];
                    while (c && !(c[0] === sx && c[1] === sy)) { path.push(c); c = prev.get(c[0] + ',' + c[1]); }
                    return path.reverse();
                }
                q.push([nx, ny]);
            }
        }
        return null;
    }

    /* ---------- ตัวละคร ---------- */
    const rt = AGENTS.map((def, i) => ({
        def, x: SPAWNS[i][0], y: SPAWNS[i][1], path: [], sit: false, walking: false,
        phase: null, task: null, timer: 0, idleT: 1 + Math.random() * 3, t: Math.random() * 10,
        state: 'idle', label: null, lastState: ''
    }));
    const byId = id => rt.find(a => a.def.id === id);
    const chairOf = a => ({ x: a.def.desk[0], y: a.def.desk[1] + 1 });

    function goTo(a, tx, ty) {
        const p = bfs(Math.round(a.x), Math.round(a.y), tx, ty);
        if (p && p.length) { a.path = p; return true; }
        return false;
    }

    function pump(a) {
        if (a.task) return;
        const t = cfg.tasks.slice().reverse().find(k => k.agentId === a.def.id && k.status === 'queued');
        if (!t) return;
        a.task = t; a.phase = 'going'; t.status = 'working';
        save(); renderTasks();
        const c = chairOf(a);
        const p = bfs(Math.round(a.x), Math.round(a.y), c.x, c.y);
        if (p === null) { finish(a, false, 'หาทางเดินไปโต๊ะไม่ได้'); return; }
        if (p.length === 0) arrive(a); else a.path = p;
    }

    function arrive(a) {
        if (a.phase === 'going') {
            a.phase = 'working'; a.sit = true;
            execute(a, a.task);
        } else if (!a.task) {
            a.idleT = 2 + Math.random() * 5;
        }
    }

    function wander(a) {
        const spots = WANDER.filter(s => s[0] !== Math.round(a.x) || s[1] !== Math.round(a.y));
        const s = spots[Math.floor(Math.random() * spots.length)];
        if (!goTo(a, s[0], s[1])) a.idleT = 3;
    }

    function update(a, dt) {
        a.t += dt;
        if (a.path.length) {
            const [tx, ty] = a.path[0];
            const dx = tx - a.x, dy = ty - a.y, dist = Math.hypot(dx, dy), step = SPEED * dt;
            if (dist <= step) { a.x = tx; a.y = ty; a.path.shift(); }
            else { a.x += dx / dist * step; a.y += dy / dist * step; }
            a.walking = true; a.back = (dx + dy) < -0.001;
            if (!a.path.length) { a.walking = false; arrive(a); }
        } else {
            a.walking = false;
            if (a.phase === 'celebrate') {
                a.timer -= dt;
                if (a.timer <= 0) { a.phase = null; a.sit = false; a.task = null; a.idleT = 1 + Math.random() * 2; }
            } else if (!a.task) {
                pump(a);
                if (!a.task) { a.idleT -= dt; if (a.idleT <= 0) { a.idleT = 4 + Math.random() * 4; wander(a); } }
            }
        }
        if (a.walking) a.state = 'walking';
        else if (a.phase === 'working') a.state = cfg.apiUrl ? 'thinking' : 'working';
        else if (a.phase === 'celebrate') a.state = a.task && a.task.status === 'error' ? 'error' : 'done';
        else a.state = 'idle';
    }

    /* ---------- ทำงานจริง/จำลอง ---------- */
    const SIM = {
        brief: t => `• โจทย์: ${t}\n• เป้าหมายที่ควรชัดก่อนเริ่ม: ผลลัพธ์ที่ต้องการ, ใครเป็นคนใช้, กำหนดส่ง\n• ข้อมูลที่ยังขาด: งบ/ข้อจำกัด และตัวอย่างงานที่ชอบ`,
        research: t => `• หัวข้อที่ควรหา: ${t}\n• ทิศทางที่ควรดู: 3 แนวทางหลัก พร้อมข้อดี-ข้อเสียของแต่ละแบบ\n• แหล่งที่ควรเช็ค: ข้อมูลล่าสุดจากแหล่งทางการ`,
        writer: t => `ร่างที่ 1 สำหรับ: ${t}\n\nเปิดด้วยประโยคสั้นที่ตรงประเด็น ตามด้วยเนื้อหาหลัก 3 ย่อหน้า และปิดด้วยสิ่งที่อยากให้ผู้อ่านทำต่อ`,
        designer: t => `ไอเดียภาพสำหรับ: ${t}\n• โทนสี: อบอุ่น คอนทราสต์ชัด\n• องค์ประกอบ: จุดโฟกัสเดียว เว้นที่ว่างพอ\n• ตัวอักษร: หัวข้อหนา อ่านง่ายบนมือถือ`,
        director: t => `สรุปการตัดสินใจสำหรับ: ${t}\n• เลือกแนวทางที่ชัดที่สุด 1 แบบ\n• สิ่งที่ต้องแก้ก่อนส่ง: 2-3 ข้อ\n• ผู้รับผิดชอบแต่ละส่วน`,
        qc: t => `เช็คลิสต์ตรวจงาน: ${t}\n☐ ตรงโจทย์ ☐ ข้อมูลถูกต้อง ☐ ภาษา/ตัวสะกด ☐ รูปแบบสม่ำเสมอ ☐ พร้อมส่ง`
    };
    function simulate(def, t) {
        return new Promise(res => setTimeout(() => {
            res('[ผลจำลอง — ยังไม่ได้เชื่อม AI จริง]\n' + SIM[def.id](t.text));
        }, 3500 + Math.random() * 3000));
    }
    async function callApi(def, t) {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 60000);
        try {
            const tokenProvider = window.getOfficeFirebaseIdToken;
            if (typeof tokenProvider !== 'function') throw new Error('ระบบล็อกอินยังไม่พร้อม');
            const idToken = await tokenProvider();
            if (!idToken) throw new Error('กรุณาเข้าสู่ระบบด้วย arisky.studio@gmail.com ก่อนใช้ AI');
            const r = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
                body: JSON.stringify({ agentId: def.id, task: t.text }), signal: ctrl.signal
            });
            if (!r.ok) throw new Error('เซิร์ฟเวอร์ตอบกลับ ' + r.status);
            const j = await r.json();
            if (!j || typeof j.text !== 'string') throw new Error('รูปแบบคำตอบจากเซิร์ฟเวอร์ไม่ถูกต้อง');
            return j.text;
        } finally { clearTimeout(to); }
    }
    async function execute(a, t) {
        t.startedAt = Date.now(); save(); renderTasks();
        let ok = true, text;
        try { text = cfg.apiUrl ? await callApi(a.def, t) : await simulate(a.def, t); }
        catch (e) { ok = false; text = e && e.name === 'AbortError' ? 'หมดเวลารอ AI (60 วินาที)' : String((e && e.message) || e); }
        finish(a, ok, text);
    }
    function finish(a, ok, text) {
        const t = a.task;
        if (t) { t.status = ok ? 'done' : 'error'; t.result = text; t.finishedAt = Date.now(); t.mode = cfg.apiUrl ? 'ai' : 'sim'; }
        save(); renderTasks();
        a.phase = 'celebrate'; a.timer = 2.4;
        if (ok) toast(`✅ ${a.def.name} ทำงานเสร็จแล้ว`);
    }

    /* ---------- เครื่องมือวาดพิกเซล (ปิด anti-alias ทั้งหมด) ---------- */
    const proj = (x, y, z) => [Math.round(OX + (x - y) * TW), Math.round(OY + (x + y) * TH - (z || 0))];
    const dot = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    function line(x0, y0, x1, y1, c) {
        ctx.fillStyle = c;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (let n = 0; n < 2000; n++) {
            ctx.fillRect(x0, y0, 1, 1);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    }
    function fillPoly(pts, c, dither) {
        let minY = Infinity, maxY = -Infinity;
        pts.forEach(p => { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; });
        ctx.fillStyle = c;
        for (let y = minY; y < maxY; y++) {
            const yc = y + 0.5, xs = [];
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i], b = pts[(i + 1) % pts.length];
                if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
            }
            xs.sort((m, n) => m - n);
            for (let i = 0; i + 1 < xs.length; i += 2) {
                const x0 = Math.round(xs[i]), x1 = Math.round(xs[i + 1]);
                if (x1 <= x0) continue;
                if (!dither) ctx.fillRect(x0, y, x1 - x0, 1);
                else for (let x = x0; x < x1; x++) if (((x + y) & 1) === 0) ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    function outline(pts, c) { for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; line(a[0], a[1], b[0], b[1], c); } }
    function fillEllipse(cx, cy, rx, ry, c) {
        ctx.fillStyle = c;
        for (let y = -ry; y <= ry; y++) {
            const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + ry))));
            ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
        }
    }
    const fillCircle = (cx, cy, r, c) => fillEllipse(cx, cy, r, r, c);

    const hex2 = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const mix = (a, b, t) => { const A = hex2(a), B = hex2(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
    const PAL = {};
    const P = base => PAL[base] || (PAL[base] = { t: mix(base, '#FFFFFF', .28), l: base, r: mix(base, '#2A1A2E', .26), o: mix(base, '#2A1A2E', .62), hi: mix(base, '#FFFFFF', .55) });
    function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

    const Q = (pts3) => pts3.map(q => proj(q[0], q[1], q[2]));
    // ภาพบนผนัง/ด้านของกล่อง: decalL = ระนาบ y คงที่ (ด้านหันหาผู้ชมซ้าย), decalR = ระนาบ x คงที่ (ด้านขวา)
    const decalL = (Y, x0, x1, z0, z1, c, dith) => fillPoly(Q([[x0, Y, z1], [x1, Y, z1], [x1, Y, z0], [x0, Y, z0]]), c, dith);
    const decalR = (X, y0, y1, z0, z1, c, dith) => fillPoly(Q([[X, y0, z1], [X, y1, z1], [X, y1, z0], [X, y0, z0]]), c, dith);
    const lineL = (Y, x0, z0, x1, z1, c) => { const a = proj(x0, Y, z0), b = proj(x1, Y, z1); line(a[0], a[1], b[0], b[1], c); };
    const lineR = (X, y0, z0, y1, z1, c) => { const a = proj(X, y0, z0), b = proj(X, y1, z1); line(a[0], a[1], b[0], b[1], c); };
    const lineF = (x0, y0, z0, x1, y1, z1, c) => { const a = proj(x0, y0, z0), b = proj(x1, y1, z1); line(a[0], a[1], b[0], b[1], c); };
    const dotAt = (x, y, z, c, s) => { const p = proj(x, y, z); rect(p[0], p[1], s || 1, s || 1, c); };

    function box(x, y, z, w, d, h, base) {
        const p = typeof base === 'string' ? P(base) : base;
        const T = Q([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]);
        const Lf = Q([[x, y + d, z + h], [x + w, y + d, z + h], [x + w, y + d, z], [x, y + d, z]]);
        const Rf = Q([[x + w, y, z + h], [x + w, y + d, z + h], [x + w, y + d, z], [x + w, y, z]]);
        fillPoly(T, p.t); fillPoly(Lf, p.l); fillPoly(Rf, p.r);
        outline(T, p.o); outline(Lf, p.o); outline(Rf, p.o);
        line(T[3][0] + 1, T[3][1], T[2][0], T[2][1] - 1, p.hi);
        line(T[2][0], T[2][1] - 1, T[1][0] - 1, T[1][1], p.hi);
    }

    /* ---------- ฉากพื้นหลัง (ท้องฟ้า ทะเล หาดทราย) ---------- */
    const HORIZON = 120;
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = W; bgCanvas.height = H;

    function cloud(x, y, s) {
        const rows = [[4, 0, 8], [2, 1, 12], [0, 2, 16]];
        rows.forEach(([ox, oy, w]) => rect(x + ox * s, y + oy * 2 * s / 2 * 1, w * s, 2 * s, '#FFF1F4'));
        rect(x, y + 4 * s - s, 16 * s, s, '#FFD0DC');
    }
    function palm(bx, by, s) {
        const trunk = ['#B07A45', '#8E5B31'];
        for (let i = 0; i <= 30 * s; i++) {
            const t = i / (30 * s), x = Math.round(bx + Math.sin(t * 1.4) * 5 * s), y = Math.round(by - i);
            rect(x - s, y, 2 * s + 1, 1, trunk[(i >> 1) & 1]);
        }
        const tx = Math.round(bx + Math.sin(1.4) * 5 * s), ty = by - 30 * s;
        const fronds = [[-15, 6], [-12, -3], [-6, -8], [6, -8], [13, -3], [16, 6], [0, -10], [-9, 11], [10, 11]];
        fronds.forEach(([dx, dy], i) => {
            const ex = tx + dx * s, ey = ty + dy * s, mx = (tx + ex) / 2, my = Math.min(ty, ey) - 4 * s;
            for (let k = 0; k <= 14; k++) {
                const t = k / 14, x = Math.round((1 - t) * (1 - t) * tx + 2 * (1 - t) * t * mx + t * t * ex);
                const y = Math.round((1 - t) * (1 - t) * ty + 2 * (1 - t) * t * my + t * t * ey);
                rect(x, y, 2, 2, i % 2 ? '#3FA05A' : '#54B86A');
                if (k % 2 === 0) dot(x, y + 2, '#2E7D46');
            }
        });
        fillCircle(tx - 2, ty + 3, 2, '#7A4A22'); fillCircle(tx + 2, ty + 3, 2, '#8E5B31');
    }
    function drawOutside() {
        const bands = [[0, '#6F58C8'], [14, '#8A62CF'], [28, '#A86CCD'], [42, '#C97DC6'], [54, '#E58AAB'], [66, '#F59A94'], [78, '#FFAD7A'], [90, '#FFC58A'], [102, '#FFDDA3']];
        bands.forEach(([y0, c], i) => {
            const y1 = i + 1 < bands.length ? bands[i + 1][0] : HORIZON;
            rect(0, y0, W, y1 - y0, c);
            if (i + 1 < bands.length) { const n = bands[i + 1][1]; for (let x = 0; x < W; x++) { if ((x & 1) === 0) dot(x, y1 - 1, n); if ((x & 3) === 0) dot(x, y1 - 2, n); } }
        });
        const r = rng(11);
        for (let i = 0; i < 26; i++) dot(Math.floor(r() * W), Math.floor(r() * 30), '#FFF3B0');
        // ดวงอาทิตย์ + แสงฟุ้ง (ดิเธอร์)
        for (let y = 60; y < 124; y++) for (let x = 340; x < W; x++) { const d = Math.hypot(x - 380, y - 96); if (d > 13 && d < 28 && ((x + y) & 1) === 0) dot(x, y, '#FFD79A'); }
        fillCircle(380, 96, 13, '#FFB84A'); fillCircle(380, 96, 11, '#FFC95C'); fillCircle(380, 96, 8, '#FFE08A');
        cloud(8, 22, 2); cloud(40, 48, 1); cloud(262, 30, 2); cloud(318, 52, 1); cloud(356, 20, 1);
        // ทะเล
        [[HORIZON, '#8FDDDB'], [128, '#6CCBD3'], [138, '#52BAC9'], [150, '#41A8C4'], [162, '#3898BA']].forEach(([y0, c], i, a) => {
            const y1 = i + 1 < a.length ? a[i + 1][0] : 172; rect(0, y0, W, y1 - y0, c);
            if (i + 1 < a.length) for (let x = (i & 1); x < W; x += 2) dot(x, y1 - 1, a[i + 1][1]);
        });
        for (let i = 0; i < 90; i++) { const x = Math.floor(r() * W), y = HORIZON + 2 + Math.floor(r() * 46); rect(x, y, 2 + Math.floor(r() * 3), 1, '#D5F6F2'); }
        for (let y = HORIZON + 2; y < 168; y += 3) rect(372 + Math.round(Math.sin(y) * 3), y, 6 - ((y / 3) & 1) * 2, 1, '#FFD79A');
        // หาดทราย + ขอบคลื่น
        rect(0, 172, W, H - 172, '#F6D8A0');
        for (let x = 0; x < W; x++) { dot(x, 172 + Math.round(Math.sin(x / 6) * 1.5), '#FFFFFF'); if (x & 1) dot(x, 175, '#E9C98F'); dot(x, 174, '#EBCB92'); }
        for (let i = 0; i < 160; i++) dot(Math.floor(r() * W), 180 + Math.floor(r() * (H - 180)), i % 3 ? '#E8C185' : '#FFEBC2');
        // เงาของฐานบนพื้นทราย (ดิเธอร์)
        fillPoly(Q([[.2, .2, -17], [COLS + .2, .2, -17], [COLS + .2, ROWS + .2, -17], [.2, ROWS + .2, -17]]), '#C99C62', true);
        // ต้นปาล์ม/ร่ม/ลูกบอล
        palm(22, 186, 1); palm(380, 198, 1);
        line(28, 238, 28, 252, '#8E5B31'); fillEllipse(28, 236, 13, 5, '#EC5E8B'); rect(18, 236, 4, 2, '#FFFFFF'); rect(28, 232, 4, 3, '#FFFFFF'); rect(34, 236, 4, 2, '#FFFFFF');
        fillCircle(372, 250, 4, '#FFFFFF'); rect(369, 248, 7, 2, '#3FA9C9'); rect(371, 246, 3, 2, '#EC5E8B');
        // ปลาดาว
        [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]].forEach(([a, b]) => rect(60 + a * 2, 244 + b * 2, 2, 2, '#F29A4B'));
    }

    /* ---------- พื้นฐานห้อง: ฐาน พื้น ผนัง หน้าต่าง ไฟประดับ ---------- */
    function floorTile(x, y) {
        const base = ((x * 7 + y * 3) % 5 === 0) ? '#E8BF84' : ((x + y) & 1 ? '#F1CE98' : '#ECC68C');
        fillPoly(Q([[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]]), base);
        const seam = '#D2A56E';
        [1 / 3, 2 / 3].forEach(f => lineF(x, y + f, 0, x + 1, y + f, 0, seam));
        const xj = x + (((x + y) & 1) ? .35 : .72), yj = y + (((x + y) & 1) ? 1 / 3 : 0);
        lineF(xj, yj, 0, xj, yj + 1 / 3, 0, seam);
        lineF(x + (((x + y) & 1) ? .8 : .2), y + 2 / 3, 0, x + (((x + y) & 1) ? .8 : .2), y + 1, 0, seam);
    }
    function rugQuad(x0, y0, x1, y1, outer, inner, accent) {
        const ins = .16;
        fillPoly(Q([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]]), outer);
        fillPoly(Q([[x0 + ins, y0 + ins, 0], [x1 - ins, y0 + ins, 0], [x1 - ins, y1 - ins, 0], [x0 + ins, y1 - ins, 0]]), inner);
        for (let x = x0 + ins + .25; x < x1 - ins; x += .5) lineF(x, y0 + ins + .1, 0, x, y1 - ins - .1, 0, mix(inner, accent, .45));
        outline(Q([[x0 + ins, y0 + ins, 0], [x1 - ins, y0 + ins, 0], [x1 - ins, y1 - ins, 0], [x0 + ins, y1 - ins, 0]]), accent);
        outline(Q([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]]), mix(outer, '#2A1A2E', .45));
        for (let y = y0 + .1; y < y1; y += .22) { dotAt(x1, y, 0, accent); dotAt(x1 + .12, y + .06, 0, mix(outer, '#FFFFFF', .3)); }
    }
    function platform() {
        const side = (pts, c) => { fillPoly(Q(pts), c); outline(Q(pts), '#6B4630'); };
        side([[0, ROWS, 0], [COLS, ROWS, 0], [COLS, ROWS, -10], [0, ROWS, -10]], '#E3B07A');
        side([[COLS, 0, 0], [COLS, ROWS, 0], [COLS, ROWS, -10], [COLS, 0, -10]], '#C4905A');
        decalL(ROWS, 0, COLS, -2, 0, '#F6D9AE'); decalR(COLS, 0, ROWS, -2, 0, '#E0B27C');
        for (let i = 1; i < COLS; i++) lineL(ROWS, i, -2, i, -10, '#B9824F');
        for (let i = 1; i < ROWS; i++) lineR(COLS, i, -2, i, -10, '#A8733F');
        lineL(ROWS, 0, -6, COLS, -6, '#B9824F'); lineR(COLS, 0, -6, ROWS, -6, '#A8733F');
        outline(Q([[0, ROWS, 0], [COLS, ROWS, 0], [COLS, ROWS, -10], [0, ROWS, -10]]), '#6B4630');
        outline(Q([[COLS, 0, 0], [COLS, ROWS, 0], [COLS, ROWS, -10], [COLS, 0, -10]]), '#6B4630');
    }

    function winGlass(side, a0, a1, z0, z1) {
        const q = (p0, p1, k0, k1, c) => side === 'B' ? decalL(0, p0, p1, k0, k1, c) : decalR(0, p0, p1, k0, k1, c);
        const L = (p0, k0, p1, k1, c) => side === 'B' ? lineL(0, p0, k0, p1, k1, c) : lineR(0, p0, k0, p1, k1, c);
        const cols = ['#8A62CF', '#B56BC9', '#E58AAB', '#FFAD7A', '#FFD79A', '#6CCBD3', '#41A8C4'];
        const h = (z1 - z0) / cols.length;
        cols.forEach((c, i) => q(a0, a1, z0 + i * h, z0 + (i + 1) * h, c));
        // ลายดิเธอร์รอยต่อ + ดวงอาทิตย์เล็ก + เมฆ
        const mid = (a0 + a1) / 2;
        q(mid - .18, mid + .18, z0 + 3.4 * h, z0 + 4.2 * h, '#FFE08A');
        q(a0 + .15, a0 + .55, z0 + 2.2 * h, z0 + 2.6 * h, '#FFE5EC');
        L(mid, z0, mid, z1, '#FFF6E6'); L(a0, (z0 + z1) / 2, a1, (z0 + z1) / 2, '#FFF6E6');
        // แสงสะท้อนกระจก
        L(a0 + .12, z1 - 2, a0 + .45, z1 - 5, '#FFFFFF');
    }
    function windowFrame(side, a0, a1, z0, z1) {
        const out = side === 'B' ? Q([[a0 - .1, 0, z1 + 1.5], [a1 + .1, 0, z1 + 1.5], [a1 + .1, 0, z0 - 1.5], [a0 - .1, 0, z0 - 1.5]]) : Q([[0, a0 - .1, z1 + 1.5], [0, a1 + .1, z1 + 1.5], [0, a1 + .1, z0 - 1.5], [0, a0 - .1, z0 - 1.5]]);
        fillPoly(out, '#FFF6E6'); outline(out, '#B9825A');
        winGlass(side, a0, a1, z0, z1);
        const gl = side === 'B' ? Q([[a0, 0, z1], [a1, 0, z1], [a1, 0, z0], [a0, 0, z0]]) : Q([[0, a0, z1], [0, a1, z1], [0, a1, z0], [0, a0, z0]]);
        outline(gl, '#B9825A');
        if (side === 'B') box(a0 - .12, 0, z0 - 3, a1 - a0 + .24, .26, 1.8, '#FFF6E6'); else box(0, a0 - .12, z0 - 3, .26, a1 - a0 + .24, 1.8, '#FFF6E6');
    }
    function curtain(side, a0, a1, z0, z1, c) {
        const q = (p0, p1, k0, k1, col) => side === 'B' ? decalL(0, p0, p1, k0, k1, col) : decalR(0, p0, p1, k0, k1, col);
        const L = (p0, k0, p1, k1, col) => side === 'B' ? lineL(0, p0, k0, p1, k1, col) : lineR(0, p0, k0, p1, k1, col);
        q(a0, a1, z0, z1, c);
        for (let a = a0 + .1; a < a1; a += .16) L(a, z0, a, z1 - 1, mix(c, '#2A1A2E', .22));
        L(a0, z0, a1, z0, mix(c, '#2A1A2E', .5)); L(a0, z1, a1, z1, mix(c, '#FFFFFF', .4));
    }

    function drawWalls() {
        const wallB = '#FFE8CC', wallL = '#F7D5B0', wainB = '#EEB988', wainL = '#E2A678', trim = '#FFF6E6', dark = '#B9825A';
        // ผนังหลัง
        decalL(0, 0, COLS, 0, WALL, wallB); decalL(0, 0, COLS, 0, 14, wainB);
        for (let i = 1; i < COLS * 2; i++) lineL(0, i / 2, 2, i / 2, 13, mix(wainB, '#8F5A32', .3));
        decalL(0, 0, COLS, 14, 16, trim); lineL(0, 0, 14, COLS, 14, dark); lineL(0, 0, 16, COLS, 16, mix(trim, dark, .4));
        decalL(0, 0, COLS, 0, 2, '#C98F62'); lineL(0, 0, 2, COLS, 2, dark);
        for (let i = 0; i < COLS * 2; i++) for (let k = 0; k < 3; k++) { const z = 20 + k * 6 + (i & 1) * 3; if (z > WALL - 5) continue; const p = proj(i / 2 + .25, 0, z); rect(p[0], p[1], 2, 1, '#F5CFA3'); }
        // ผนังซ้าย
        decalR(0, 0, ROWS, 0, WALL, wallL); decalR(0, 0, ROWS, 0, 14, wainL);
        for (let i = 1; i < ROWS * 2; i++) lineR(0, i / 2, 2, i / 2, 13, mix(wainL, '#8F5A32', .3));
        decalR(0, 0, ROWS, 14, 16, trim); lineR(0, 0, 14, ROWS, 14, dark); lineR(0, 0, 16, ROWS, 16, mix(trim, dark, .4));
        decalR(0, 0, ROWS, 0, 2, '#BC845A'); lineR(0, 0, 2, ROWS, 2, dark);
        for (let i = 0; i < ROWS * 2; i++) for (let k = 0; k < 3; k++) { const z = 20 + k * 6 + (i & 1) * 3; if (z > WALL - 5) continue; const p = proj(0, i / 2 + .25, z); rect(p[0], p[1], 2, 1, '#EDBF93'); }
        // ขอบบนและหน้าตัดผนัง (หนา 0.4)
        const topB = Q([[-.4, -.4, WALL], [COLS, -.4, WALL], [COLS, 0, WALL], [-.4, 0, WALL]]);
        const topL = Q([[-.4, -.4, WALL], [0, -.4, WALL], [0, ROWS, WALL], [-.4, ROWS, WALL]]);
        fillPoly(topB, '#FFFAF0'); fillPoly(topL, '#FFF1DC'); outline(topB, dark); outline(topL, dark);
        const endB = Q([[COLS, -.4, WALL], [COLS, 0, WALL], [COLS, 0, 0], [COLS, -.4, 0]]);
        const endL = Q([[-.4, ROWS, WALL], [0, ROWS, WALL], [0, ROWS, 0], [-.4, ROWS, 0]]);
        fillPoly(endB, '#E9B58A'); fillPoly(endL, '#E0A57A'); outline(endB, dark); outline(endL, dark);
        // หน้าต่าง + ม่าน
        windowFrame('B', 2.75, 4.0, 19, 38); windowFrame('W', 5.15, 7.45, 19, 38);
        curtain('B', 2.42, 2.72, 15, 41, '#F58FB0'); curtain('B', 4.03, 4.33, 15, 41, '#F58FB0');
        curtain('W', 4.82, 5.12, 15, 41, '#F58FB0'); curtain('W', 7.48, 7.78, 15, 41, '#F58FB0');
        // กระดานงานบนผนัง (กรอบ + พื้นขาว + แถบหัวข้อ)
        const bd = Q([[4.5, 0, 39], [7.1, 0, 39], [7.1, 0, 16], [4.5, 0, 16]]);
        fillPoly(bd, '#C48650'); outline(bd, '#6B4630');
        decalL(0, 4.58, 7.02, 17, 38, '#FFFDF6');
        decalL(0, 4.58, 7.02, 34, 38, '#8E5BD6');
        for (let i = 0; i < 4; i++) lineL(0, 4.68 + i * .1, 36, 4.74 + i * .1, 36, '#FFF6E6');
        lineL(0, 5.9, 36, 6.9, 36, '#FFD36B');
        box(4.55, 0, 14.5, 2.5, .2, 1.5, '#D9A066');
        // กรอบรูปบนผนังซ้าย (ภาพวิวพิกเซล)
        const fr = Q([[0, 2.45, 38], [0, 4.2, 38], [0, 4.2, 25], [0, 2.45, 25]]);
        fillPoly(fr, '#C48650'); outline(fr, '#6B4630');
        decalR(0, 2.55, 4.1, 27, 36, '#FFD79A'); decalR(0, 2.55, 4.1, 27, 30, '#5BC3CF');
        decalR(0, 2.6, 3.0, 30, 34, '#8E5BD6'); fillPoly(Q([[0, 3.2, 28], [0, 3.55, 28], [0, 3.38, 33]]), '#3FA05A');
        dotAt(0, 3.8, 34, '#FFE08A', 2);
        // ชั้นลอยติดผนังโซนกาแฟ
        box(8.1, 0, 25, 1.8, .42, 1.4, '#C48650');
        // ไฟประดับ
        const cols = ['#FFD36B', '#FF8FB1', '#9FE8EA', '#CCFF99'];
        for (let i = 0; i <= 80; i++) {
            const t = i / 80, x = .3 + t * (COLS - .6), z = WALL - 3 - Math.round(4 * (1 - Math.pow(2 * t - 1, 2)));
            const p = proj(x, 0, z); dot(p[0], p[1], '#6B4630');
            if (i % 5 === 2) { rect(p[0], p[1] + 1, 2, 2, cols[(i / 5 | 0) % 4]); dot(p[0] - 1, p[1] + 1, mix(cols[(i / 5 | 0) % 4], '#FFFFFF', .5)); }
        }
        for (let i = 0; i <= 60; i++) {
            const t = i / 60, y = .3 + t * (ROWS - .6), z = WALL - 3 - Math.round(4 * (1 - Math.pow(2 * t - 1, 2)));
            const p = proj(0, y, z); dot(p[0], p[1], '#6B4630');
            if (i % 5 === 2) { rect(p[0], p[1] + 1, 2, 2, cols[((i / 5 | 0) + 2) % 4]); }
        }
    }

    function buildBackground() {
        const bctx = bgCanvas.getContext('2d');
        bctx.imageSmoothingEnabled = false;
        ctx = bctx;
        try {
            drawOutside();
            platform();
            for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) floorTile(x, y);
            // โซนกาแฟ: กระเบื้องหมากรุกสีมิ้นต์
            for (let y = 0; y < 2; y++) for (let x = 8; x < 10; x++) {
                fillPoly(Q([[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]]), (x + y) & 1 ? '#F7FBF3' : '#BFE8DC');
                outline(Q([[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]]), '#9CCDBD');
            }
            // โซนพักผ่อน (พรมชมพู) + โซนประชุม (พรมเขียวน้ำทะเล)
            rugQuad(0, 4.85, 3.1, 8, '#EE8FB0', '#F9B8CC', '#FFF0D6');
            rugQuad(2.6, 5.7, 7.4, 8, '#3FA9A9', '#69C9C2', '#FFE7A8');
            drawWalls();
        } finally { ctx = mainCtx; }
    }

    /* ---------- เฟอร์นิเจอร์ (วาดครั้งเดียวเป็นสไปรต์ แล้วเรียงตามความลึก) ---------- */
    const statics = [], dyn = [];
    function spr(depth, x, y, w, d, h, fn, pad) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].forEach(([a, b]) => [0, h].forEach(z => {
            const p = proj(a, b, z); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
        }));
        const pd = pad || 8; x0 -= pd; y0 -= pd; x1 += pd; y1 += pd;
        const cv = document.createElement('canvas'); cv.width = x1 - x0 + 1; cv.height = y1 - y0 + 1;
        const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.translate(-x0, -y0);
        const keep = ctx; ctx = c;
        try { fn(); } finally { ctx = keep; }
        statics.push({ d: depth, fn: () => ctx.drawImage(cv, x0, y0) });
    }

    function bush(cx, cy, r, big) {
        const greens = ['#2E7D46', '#3FA05A', '#5DC27A', '#8FE0A0'];
        const blobs = [[0, 0, r], [-r * .8, r * .35, r * .75], [r * .8, r * .35, r * .75], [0, -r * .75, r * .7], [-r * .5, -r * .4, r * .6], [r * .5, -r * .4, r * .6]];
        blobs.forEach(([dx, dy, rr]) => fillCircle(Math.round(cx + dx), Math.round(cy + dy), Math.round(rr) + 1, '#1F5A33'));
        blobs.forEach(([dx, dy, rr], i) => fillCircle(Math.round(cx + dx), Math.round(cy + dy), Math.round(rr), greens[(i + 1) % 3]));
        const rn = rng(cx * 7 + cy);
        for (let i = 0; i < (big ? 14 : 8); i++) { const a = rn() * 6.28, d = rn() * r * .8; dot(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * .8 - 1), greens[3]); }
        if (big) { dot(cx - 3, cy - 2, '#FF8FB1'); dot(cx + 4, cy + 1, '#FFD36B'); dot(cx + 1, cy - 5, '#FF8FB1'); }
    }
    function plantAt(tx, ty, tall) {
        const x = tx + .22, y = ty + .22;
        spr(tx + ty + 1, x, y, .56, .56, 8 + (tall ? 18 : 12), () => {
            box(x, y, 0, .56, .56, 7, '#F58FB0');
            const [px, py] = proj(tx + .5, ty + .5, 8 + (tall ? 5 : 3));
            bush(px, py, tall ? 8 : 6, tall);
        });
    }

    const WOOD = '#D9A066', DARKWOOD = '#B9773F', STEEL = '#9AA7B8', CREAM = '#FFF6E6';

    function bookshelf() {
        spr(1.5, 0.05, 0.05, 2.15, 0.7, 34, () => {
            box(0.05, 0.05, 0, 2.15, 0.7, 34, DARKWOOD);
            const Y = .75;
            decalL(Y, .12, 2.13, 2, 33, '#7A4A22');
            [12.5, 23].forEach(z => { decalL(Y, .1, 2.15, z, z + 1.6, '#D9A066'); lineL(Y, .1, z + 1.6, 2.15, z + 1.6, '#F2C58B'); lineL(Y, .1, z, 2.15, z, '#6B4630'); });
            const bc = ['#EC5E8B', '#3FA9C9', '#A8E6A1', '#8E5BD6', '#FFD36B', '#F29A4B', '#FFFFFF', '#5BBF7A'];
            const r = rng(5);
            [[2, 11], [14, 21.5], [24.6, 32]].forEach(([z0, z1], row) => {
                let x = .16;
                while (x < 1.95) {
                    const w = .125 + (r() < .25 ? .125 : 0), h = 4.5 + Math.floor(r() * (z1 - z0 - 5.2));
                    if (row === 2 && x > 1.1 && x < 1.55) { x += w; continue; }
                    const c = bc[Math.floor(r() * bc.length)];
                    decalL(Y, x, x + w - .02, z0, z0 + h, c); lineL(Y, x, z0 + h, x + w - .02, z0 + h, mix(c, '#FFFFFF', .5));
                    x += w;
                }
            });
            // ลูกโลกเล็ก + กรอบรูป บนชั้นบน
            const gp = proj(1.35, .55, 24.6 + 2); fillCircle(gp[0], gp[1] - 3, 4, '#2E7D9A'); rect(gp[0] - 2, gp[1] - 5, 3, 2, '#5DC27A'); rect(gp[0], gp[1] - 3, 3, 2, '#5DC27A'); rect(gp[0] - 1, gp[1] + 1, 3, 3, '#8E5B31');
        }, 12);
    }
    function cabinets() {
        [2.1, 3.1].forEach((y0, k) => {
            spr(0.4 + y0 + .45, 0.05, y0, 0.78, 0.9, 24, () => {
                box(0.05, y0, 0, 0.78, 0.9, 22, STEEL);
                const X = .83;
                [[1.2, 7.2], [8.2, 14.2], [15.2, 21.2]].forEach(([z0, z1]) => {
                    decalR(X, y0 + .08, y0 + .84, z0, z1, '#B8C4D4'); lineR(X, y0 + .08, z0, y0 + .84, z0, '#6C7A8E'); lineR(X, y0 + .08, z1, y0 + .84, z1, '#E6EEF8');
                    decalR(X, y0 + .3, y0 + .62, z1 - 2.8, z1 - 1.9, '#5A6678'); decalR(X, y0 + .42, y0 + .5, z0 + 1.3, z0 + 2.7, '#FFF6E6');
                });
                if (k === 0) { box(.2, y0 + .15, 22, .4, .3, 2, '#FFFFFF'); box(.22, y0 + .2, 24, .36, .26, 2, '#FFD36B'); }
                else { const [px, py] = proj(.4, y0 + .45, 22); box(.2, y0 + .25, 22, .35, .35, 4, '#F29A4B'); bush(px + 1, py - 9, 6, false); }
            }, 16);
        });
    }
    function sofa() {
        spr(6.5, 0.05, 5.05, 1.0, 1.9, 18, () => {
            const body = '#EC7A8E';
            box(.05, 5.05, 0, 1.0, 1.9, 6, body);
            box(.05, 5.05, 6, .34, 1.9, 8, body);
            box(.05, 5.05, 6, 1.0, .3, 4, mix(body, '#FFFFFF', .08));
            box(.05, 6.65, 6, 1.0, .3, 4, mix(body, '#FFFFFF', .08));
            box(.4, 5.38, 6, .58, .62, 2, '#F7A3B5'); box(.4, 6.0, 6, .58, .62, 2, '#F7A3B5');
            lineR(1.05, 5.1, 3, 6.95, 3, mix(body, '#2A1A2E', .4));
            box(.36, 6.15, 8, .2, .5, 3, '#FFD36B'); // หมอนอิง
            dotAt(.4, 6.3, 12, '#FFF6E6');
        }, 10);
    }
    function coffeeTable() {
        spr(7.7, 1.15, 5.85, .7, .7, 12, () => {
            box(1.15, 5.85, 0, .7, .7, 6, '#D9A066');
            box(1.18, 5.88, 6, .64, .64, .9, '#F2C58B');
            box(1.3, 6.0, 6.9, .22, .2, .4, '#FFFFFF'); box(1.45, 6.08, 6.9, .16, .16, 1.8, '#EC5E8B');
            box(1.52, 6.28, 6.9, .2, .2, 1.4, '#FFD36B'); dotAt(1.62, 6.3, 8.8, '#FFFFFF');
        }, 8);
    }
    function meetingTable() {
        const cx = 5, cy = 7.2;
        const [sx, sy] = proj(cx, cy, 0);
        // สตูลนั่งประชุม (เบาะสีสด)
        [[3.45, 6.5], [6.25, 6.5], [3.7, 7.5], [6.0, 7.5]].forEach(([x, y], i) => spr(x + y + .5, x, y, .5, .5, 8, () => {
            box(x + .05, y + .05, 0, .4, .4, 4, '#7A5A3A'); box(x, y, 4, .5, .5, 2, ['#EC5E8B', '#FFD36B', '#8E5BD6', '#F29A4B'][i]);
        }, 6));
        spr(cx + cy + .3, 4, 6.2, 2, 2, 14, () => {
            fillEllipse(sx, sy - 1, 8, 3, '#6B4630'); fillEllipse(sx, sy - 2, 7, 2, '#9A6434');
            rect(sx - 2, sy - 10, 5, 9, '#8E5B31'); rect(sx - 1, sy - 10, 2, 9, '#B9773F');
            fillEllipse(sx, sy - 9, 19, 9, '#6B4630'); fillEllipse(sx, sy - 11, 18, 8, '#E2A868'); fillEllipse(sx, sy - 12, 16, 6, '#F2C58B');
            for (let i = -12; i <= 12; i += 6) { const w = Math.round(6 * Math.sqrt(1 - (i * i) / 169)); line(sx + i - w, sy - 12 - Math.round(w * .5), sx + i + w, sy - 12 + Math.round(w * .5), '#E2A868'); }
            // โน้ตบุ๊ก กระดาษประชุม แก้วกาแฟ โพสต์อิท
            rect(sx - 9, sy - 17, 8, 4, '#2B2B3A'); rect(sx - 8, sy - 16, 6, 2, '#7ED3D6'); rect(sx - 10, sy - 13, 10, 2, '#DDE3EA');
            rect(sx + 3, sy - 15, 7, 4, '#FFFFFF'); rect(sx + 4, sy - 14, 5, 1, '#8E5BD6'); rect(sx + 4, sy - 12, 4, 1, '#C9C9C9');
            rect(sx - 1, sy - 16, 3, 3, '#FFFFFF'); rect(sx - 1, sy - 16, 3, 1, '#3B2A22');
            rect(sx - 13, sy - 12, 3, 3, '#FFD36B'); rect(sx + 11, sy - 13, 2, 2, '#EC5E8B');
        }, 12);
    }
    function coffeeCorner() {
        spr(9.45, 8.1, 0.05, 1.8, 0.8, 44, () => {
            // ตู้เคาน์เตอร์
            box(8.1, .05, 0, 1.8, .8, 11, '#F4EAD8');
            const Y = .85;
            decalL(Y, 8.15, 9.85, 1, 9.5, '#E7D6B8');
            lineL(Y, 9.0, 1, 9.0, 9.5, '#B9A27E');
            decalL(Y, 8.55, 8.7, 6, 7.5, '#6B4630'); decalL(Y, 9.3, 9.45, 6, 7.5, '#6B4630');
            box(8.1, .02, 11, 1.8, .86, 1.2, '#D9A066');
            // เครื่องชงกาแฟ
            box(8.3, .12, 12.2, .72, .6, 12, '#E8E8F0');
            decalL(.72, 8.38, 8.94, 13.4, 20, '#2B2B3A'); decalL(.72, 8.44, 8.88, 14.4, 17, '#4A8FA8');
            decalL(.72, 8.5, 8.8, 21, 22.5, '#EC5E8B'); dotAt(8.8, .72, 19, '#CCFF00'); dotAt(8.6, .72, 19, '#FF5050');
            decalL(.72, 8.55, 8.75, 12.6, 15, '#7A4A22');
            // แก้ว โถกาแฟ
            box(9.2, .25, 12.2, .22, .22, 2.2, '#FFFFFF'); box(9.55, .22, 12.2, .22, .22, 2.2, '#EC5E8B');
            box(9.3, .55, 12.2, .45, .26, 4, '#8E5BD6');
            // ชั้นลอย: ถ้วยและต้นไม้
            box(8.1, 0, 25, 1.8, .42, 1.4, '#C48650');
            box(8.3, .1, 26.4, .2, .2, 2, '#FFFFFF'); box(8.62, .1, 26.4, .2, .2, 2, '#FFD36B'); box(8.94, .1, 26.4, .2, .2, 2, '#3FA9C9');
            const [px, py] = proj(9.6, .2, 27.4); box(9.5, .1, 26.4, .22, .22, 1.8, '#F58FB0'); bush(px, py - 3, 4, false);
        }, 14);
        // ไอกาแฟ (เคลื่อนไหว)
        dyn.push({ d: 9.6, fn: t => { const p = proj(8.64, .4, 24.8); for (let i = 0; i < 3; i++) { const k = (t * 1.2 + i / 3) % 1; dot(p[0] + Math.round(Math.sin(k * 6 + i) * 2), p[1] - Math.round(k * 9), mix('#FFFFFF', '#FFD79A', k)); if (k < .6) dot(p[0] + Math.round(Math.sin(k * 6 + i) * 2) + 1, p[1] - Math.round(k * 9) - 1, '#FFFFFF'); } } });
    }
    function utilityCorner() {
        // เครื่องพิมพ์บนตู้เล็ก
        spr(15.5, 9.1, 6.1, .8, .8, 24, () => {
            box(9.1, 6.1, 0, .8, .8, 8, '#B9773F');
            box(9.14, 6.14, 8, .72, .7, 4.5, '#EDEFF3'); decalL(6.84, 9.2, 9.8, 9, 11, '#2B2B3A'); box(9.2, 6.2, 12.5, .6, .4, .5, '#FFFFFF');
            dotAt(9.7, 6.84, 10.6, '#5BBF7A');
        }, 8);
        // ตู้กดน้ำ
        spr(16.5, 9.15, 7.15, .7, .7, 36, () => {
            box(9.15, 7.15, 0, .7, .7, 18, '#8FD3E8');
            decalL(7.85, 9.2, 9.8, 2, 6, '#5BA9C8'); decalL(7.85, 9.35, 9.5, 10, 12, '#EC5E8B'); decalL(7.85, 9.55, 9.7, 10, 12, '#3FA9C9');
            box(9.25, 7.25, 18, .5, .5, 10, '#CFEFFF'); decalL(7.75, 9.28, 9.72, 19, 26, '#EAF8FF'); decalR(9.75, 7.28, 7.72, 19, 26, '#BDE6F6');
            dotAt(9.4, 7.75, 22, '#FFFFFF', 2);
        }, 8);
    }

    // โต๊ะทำงาน + จอ + เก้าอี้ ของแต่ละคน
    const DESKX = {
        brief: () => { box(1.12, 1.55, 10, .35, .28, .8, '#FFFFFF'); box(1.15, 1.58, 10.8, .3, .22, .8, '#F5F0E0'); box(1.2, 1.62, 11.6, .22, .16, .8, '#FFFFFF'); },
        research: () => { box(4.12, 1.55, 10, .34, .3, 1.2, '#3FA9C9'); box(4.12, 1.57, 11.2, .3, .26, 1.2, '#EC5E8B'); box(4.15, 1.6, 12.4, .25, .2, 1.2, '#FFD36B'); },
        writer: () => { box(7.1, 1.5, 10, .42, .36, .5, '#FFFFFF'); box(7.14, 1.52, 10.5, .34, .3, .3, '#FFD36B'); },
        designer: () => { box(1.1, 1.5 + 3, 10, .4, .3, .5, '#2B2B3A'); box(1.14, 4.56, 10.5, .3, .22, .3, '#8E5BD6'); [['#EC5E8B', 0], ['#3FA9C9', .09], ['#FFD36B', .18], ['#5BBF7A', .27]].forEach(([c, o]) => box(1.1 + o, 4.9, 10, .08, .08, 1, c)); },
        director: () => { box(4.12, 4.52, 10, .3, .22, 1, '#FFD36B'); box(4.17, 4.56, 11, .2, .14, 2.4, '#FFE08A'); box(4.2, 4.62, 13.4, .14, .1, .8, '#FFD36B'); },
        qc: () => { box(7.1, 4.52, 10, .36, .3, .5, '#8B5E34'); box(7.14, 4.56, 10.5, .28, .22, .3, '#FFFFFF'); box(7.2, 4.6, 10.8, .08, .08, .8, '#5BBF7A'); }
    };
    function desks() {
        AGENTS.forEach(def => {
            const [dx, dy] = def.desk;
            spr(dx + dy + 1, dx, dy, 1, 1, 26, () => {
                const wood = WOOD;
                // ตู้ลิ้นชักข้างขวา + ขาซ้าย
                box(dx + .6, dy + .12, 0, .36, .76, 9, '#C48650');
                decalL(dy + .88, dx + .64, dx + .92, 1, 4, '#E2A868'); decalL(dy + .88, dx + .64, dx + .92, 5, 8, '#E2A868');
                decalL(dy + .88, dx + .72, dx + .84, 2.3, 3, '#6B4630'); decalL(dy + .88, dx + .72, dx + .84, 6.3, 7, '#6B4630');
                box(dx + .06, dy + .12, 0, .1, .1, 9, '#B9773F'); box(dx + .06, dy + .78, 0, .1, .1, 9, '#B9773F');
                box(dx + .02, dy + .08, 9, .96, .84, 1.4, wood);
                // จอคอม + แป้นพิมพ์ + เมาส์
                box(dx + .44, dy + .3, 10.4, .18, .14, 1, '#3A3A4A');
                box(dx + .24, dy + .3, 11.4, .56, .08, 9, '#2B2B3A');
                decalL(dy + .38, dx + .28, dx + .76, 12.4, 19.4, '#14142B');
                box(dx + .28, dy + .55, 10.4, .38, .17, .5, '#F4F4F4');
                for (let i = 0; i < 4; i++) lineL(dy + .72, dx + .3 + i * .09, 10.9, dx + .34 + i * .09, 10.9, '#B9B9C9');
                box(dx + .12, dy + .58, 10.4, .1, .12, .5, '#FFFFFF');
                DESKX[def.id]();
            }, 12);
            // เก้าอี้: เบาะ + ขา และพนักพิง (วาดแยกเพื่อให้คนนั่งอยู่ระหว่างกลาง)
            spr(dx + dy + 2.0, dx + .2, dy + 1.2, .6, .6, 8, () => {
                box(dx + .46, dy + 1.46, 0, .08, .08, 4, '#2B2B3A');
                lineF(dx + .5, dy + 1.5, .5, dx + .22, dy + 1.28, .5, '#2B2B3A'); lineF(dx + .5, dy + 1.5, .5, dx + .78, dy + 1.28, .5, '#2B2B3A');
                lineF(dx + .5, dy + 1.5, .5, dx + .22, dy + 1.74, .5, '#2B2B3A'); lineF(dx + .5, dy + 1.5, .5, dx + .78, dy + 1.74, .5, '#2B2B3A');
                box(dx + .2, dy + 1.2, 4, .6, .6, 2.4, '#F6C85F');
            }, 6);
            spr(dx + dy + 2.45, dx + .2, dy + 1.62, .6, .12, 10, () => {
                box(dx + .2, dy + 1.62, 6.4, .6, .12, 3.2, '#F6C85F');
            }, 6);
        });
    }
    // จอคอมที่เปลี่ยนตามสถานะพนักงาน (เคลื่อนไหว)
    function deskScreens() {
        AGENTS.forEach(def => {
            const [dx, dy] = def.desk;
            dyn.push({ d: dx + dy + 1.05, fn: t => {
                const a = byId(def.id), Y = dy + .385, x0 = dx + .28, x1 = dx + .76;
                const working = a.phase === 'working' && a.sit, cel = a.phase === 'celebrate' && a.sit;
                let bg = '#14142B', fg = '#2E2E5C';
                if (working) { bg = cfg.apiUrl ? '#3A2A6A' : '#0F5C74'; fg = cfg.apiUrl ? '#CDB6FF' : '#9FF0F4'; }
                if (cel) { bg = a.task && a.task.status === 'error' ? '#7A1F3D' : '#145A36'; fg = '#FFFFFF'; }
                decalL(Y, x0 + .02, x1 - .02, 12.6, 19.2, bg);
                if (working) {
                    for (let i = 0; i < 4; i++) {
                        const w = .12 + .26 * (.5 + .5 * Math.sin(t * 2.2 + i * 1.7 + def.desk[0]));
                        lineL(Y, x0 + .07, 18 - i * 1.6, x0 + .07 + w, 18 - i * 1.6, fg);
                    }
                    if (Math.floor(t * 2) % 2) dotAt(x0 + .45, Y, 12.9, '#FFFFFF');
                } else if (cel) {
                    const ok = !(a.task && a.task.status === 'error');
                    if (ok) { lineL(Y, x0 + .18, 15.2, x0 + .26, 13.8, fg); lineL(Y, x0 + .26, 13.8, x0 + .4, 18, fg); }
                    else { lineL(Y, x0 + .18, 17.5, x0 + .38, 13.5, fg); lineL(Y, x0 + .18, 13.5, x0 + .38, 17.5, fg); }
                } else { lineL(Y, x0 + .16, 16, x0 + .3, 16, fg); dotAt(x0 + .36, Y, 16, '#6C6CA8'); }
                // เงาแสงจอบนโต๊ะ
                if (working) fillPoly(Q([[dx + .26, dy + .45, 10.4], [dx + .78, dy + .45, 10.4], [dx + .78, dy + .55, 10.4], [dx + .26, dy + .55, 10.4]]), cfg.apiUrl ? '#B9A0F0' : '#7ED3D6', true);
            } });
        });
    }
    function buildFurniture() {
        statics.length = 0; dyn.length = 0;
        bookshelf(); cabinets(); sofa(); coffeeTable(); meetingTable(); coffeeCorner(); utilityCorner();
        desks(); deskScreens();
        plantAt(0, 7, true); plantAt(9, 3, true);
        // แมวนอนบนพรมโซนพักผ่อน
        dyn.push({ d: 8.9, fn: t => {
            const [x, y] = proj(1.6, 7.35, 0), br = Math.round(Math.sin(t * 2) * .6 + .4);
            fillEllipse(x, y + 1, 9, 3, 'rgba(42,26,46,.22)');
            fillEllipse(x, y - 2, 8, 4 - 0 + br, '#2A1A2E'); fillEllipse(x, y - 2, 7, 3 + br, '#F2A65A');
            for (let i = -4; i <= 3; i += 3) rect(x + i, y - 5 + br, 1, 3, '#C97A30');
            fillCircle(x - 7, y - 3, 4, '#2A1A2E'); fillCircle(x - 7, y - 3, 3, '#F2A65A');
            rect(x - 10, y - 8, 2, 3, '#F2A65A'); rect(x - 6, y - 8, 2, 3, '#F2A65A'); dot(x - 10, y - 8, '#2A1A2E'); dot(x - 5, y - 8, '#2A1A2E');
            rect(x - 8, y - 3, 2, 1, '#2A1A2E'); rect(x - 5, y - 3, 2, 1, '#2A1A2E');
            const tl = Math.round(Math.sin(t * 1.5) * 2); line(x + 6, y - 1, x + 11, y - 2 + tl, '#C97A30'); line(x + 6, y, x + 11, y - 1 + tl, '#2A1A2E');
            const zk = (t * .7) % 1; ctx.fillStyle = mix('#FFFFFF', '#F7B8CC', zk); ctx.fillRect(x - 6, y - 12 - Math.round(zk * 8), 3, 1); ctx.fillRect(x - 5, y - 11 - Math.round(zk * 8), 1, 1); ctx.fillRect(x - 6, y - 10 - Math.round(zk * 8), 3, 1);
        } });
        // นาฬิกาติดผนัง ใช้เวลาจริง
        dyn.push({ d: 0.1, fn: () => {
            const [cx, cy] = proj(7.7, 0, 34), n = new Date();
            fillCircle(cx, cy, 8, '#6B4630'); fillCircle(cx, cy, 7, '#FFF6E6');
            [[0, -5], [5, 0], [0, 5], [-5, 0]].forEach(([a, b]) => dot(cx + a, cy + b, '#3B2A22'));
            const m = n.getMinutes() / 60 * 6.283, h = (n.getHours() % 12 + n.getMinutes() / 60) / 12 * 6.283;
            line(cx, cy, cx + Math.round(Math.sin(m) * 5), cy - Math.round(Math.cos(m) * 5), '#3B2A22');
            line(cx, cy, cx + Math.round(Math.sin(h) * 3), cy - Math.round(Math.cos(h) * 3), '#EC5E8B');
            dot(cx, cy, '#3B2A22');
        } });
    }

    /* ---------- ตัวละครพิกเซล (สไปรต์ 10x13 + ขา/แขนวาดตามท่าทาง) ---------- */
    const SPR_FRONT = [
        '...oooo...',
        '..ohhhho..',
        '.ohhhhhho.',
        '.ohhhhhho.',
        '.ohssssho.',
        '.osesseso.',
        '.osssssso.',
        '..osssso..',
        '..occcco..',
        '.occcccco.',
        'osccccccso',
        'osccccccso',
        '.oppppppo.'
    ];
    const SPR_BACK = [
        '...oooo...',
        '..ohhhho..',
        '.ohhhhhho.',
        '.ohhhhhho.',
        '.ohhhhhho.',
        '.ohhhhhho.',
        '.ohhhhhho.',
        '..ohhhho..',
        '..occcco..',
        '.occcccco.',
        'osccccccso',
        'osccccccso',
        '.oppppppo.'
    ];
    function blit(map, ox, oy, pal, skipRows) {
        for (let r = 0; r < map.length; r++) {
            if (skipRows && skipRows.indexOf(r) >= 0) continue;
            const row = map[r];
            for (let c = 0; c < row.length; c++) { const ch = row[c]; if (ch !== '.') dot(ox + c, oy + r, pal[ch]); }
        }
    }
    function accessory(id, ox, oy, back, pal) {
        const hc = pal.h, ink = INK;
        if (id === 'brief') { fillCircle(ox + 5, oy - 1, 2, ink); fillCircle(ox + 5, oy - 1, 1, hc); if (!back) { rect(ox + 2, oy + 4, 3, 1, '#FFFFFF'); rect(ox + 5, oy + 4, 3, 1, '#FFFFFF'); dot(ox + 2, oy + 4, ink); dot(ox + 7, oy + 4, ink); } }
        if (id === 'research') { rect(ox + 1, oy, 8, 2, '#3FA9C9'); rect(ox, oy + 2, 10, 1, '#2D7F9C'); if (!back) rect(ox + 1, oy + 3, 8, 1, '#2D7F9C'); dot(ox + 4, oy, '#FFFFFF'); }
        if (id === 'writer') { rect(ox, oy + 3, 1, 6, hc); rect(ox + 9, oy + 3, 1, 6, hc); dot(ox, oy + 9, ink); dot(ox + 9, oy + 9, ink); if (!back) { dot(ox + 3, oy + 5, '#FFFFFF'); } }
        if (id === 'designer') { rect(ox - 1, oy + 3, 2, 4, hc); rect(ox + 9, oy + 3, 2, 4, hc); dot(ox - 1, oy + 7, '#F7A3B5'); dot(ox + 10, oy + 7, '#F7A3B5'); rect(ox + 3, oy + 1, 2, 1, '#FFD36B'); }
        if (id === 'director') { if (!back) { dot(ox + 5, oy + 9, '#FFFFFF'); dot(ox + 4, oy + 9, '#FFFFFF'); rect(ox + 5, oy + 10, 1, 3, '#EC5E8B'); } rect(ox + 1, oy + 1, 8, 1, mix(hc, '#FFFFFF', .25)); }
        if (id === 'qc') { rect(ox, oy + 4, 1, 3, '#2B2B3A'); rect(ox + 9, oy + 4, 1, 3, '#2B2B3A'); rect(ox + 1, oy, 8, 1, '#2B2B3A'); if (!back) { line(ox + 9, oy + 6, ox + 7, oy + 8, '#2B2B3A'); dot(ox + 7, oy + 8, '#FF5050'); } }
    }
    function drawAgent(a) {
        const d = a.def, sit = a.sit;
        const pal = { o: INK, h: d.hair, s: d.skin, c: d.shirt, p: '#3B3560', k: '#2B2B3A', e: INK };
        const [sx, sy] = proj(a.x + .5, a.y + (sit ? .3 : .5), 0);
        const step = a.walking ? Math.floor(a.t * 9) % 2 : 0;
        const hop = a.phase === 'celebrate' ? (Math.floor(a.t * 8) % 2 ? -2 : 0) : (a.walking ? (step ? -1 : 0) : 0);
        // เงา
        fillEllipse(sx, sy + 1, 6, 2, 'rgba(42,26,46,.3)');
        const back = sit || a.back;
        const ox = sx - 5;
        if (sit) {
            const oy = sy - 6 - 12;
            blit(back ? SPR_BACK : SPR_FRONT, ox, oy, pal, [10, 11, 12]);
            // ไหล่/แขนวางบนโต๊ะ และมือพิมพ์
            const typing = a.phase === 'working';
            const k1 = typing ? Math.floor(a.t * 9) % 2 : 0, k2 = typing ? 1 - k1 : 0;
            rect(ox - 1, oy + 9, 2, 2, d.shirt); rect(ox + 9, oy + 9, 2, 2, d.shirt);
            dot(ox - 1, oy + 11 - k1, d.skin); dot(ox + 10, oy + 11 - k2, d.skin); dot(ox, oy + 11 - k1, INK); dot(ox + 9, oy + 11 - k2, INK);
            rect(ox + 2, oy + 12, 6, 2, '#3B3560');
            accessory(d.id, ox, oy, true, pal);
        } else {
            const legTop = sy - 6 + hop, oy = legTop - 13;
            // ขา (ก้าวสลับ)
            const l1 = a.walking ? (step ? -1 : 1) : 0;
            rect(ox + 2, legTop, 2, 4 - Math.max(0, -l1), '#3B3560'); rect(ox + 6, legTop, 2, 4 - Math.max(0, l1), '#3B3560');
            rect(ox + 2, legTop + 4 - Math.max(0, -l1), 3, 2, '#2B2B3A'); rect(ox + 5, legTop + 4 - Math.max(0, l1), 3, 2, '#2B2B3A');
            blit(back ? SPR_BACK : SPR_FRONT, ox, oy, pal);
            if (a.walking) { dot(ox, oy + 11 + (step ? 1 : 0), d.skin); dot(ox + 9, oy + 11 + (step ? 0 : 1), d.skin); }
            if (a.phase === 'celebrate') { rect(ox - 1, oy + 7, 2, 3, d.shirt); rect(ox + 9, oy + 7, 2, 3, d.shirt); dot(ox - 1, oy + 6, d.skin); dot(ox + 10, oy + 6, d.skin); }
            accessory(d.id, ox, oy, back, pal);
        }
        const top = sy - (sit ? 22 : 20) + hop;
        // ฟองความคิด / ดาว
        if (a.state === 'thinking' || a.state === 'working') {
            const bx = sx - 16, by = top - 2;
            rect(bx, by, 13, 7, INK); rect(bx + 1, by + 1, 11, 5, '#FFFFFF'); dot(bx + 1, by + 7, INK); dot(bx, by + 8, INK);
            for (let i = 0; i < 3; i++) if (((Math.floor(a.t * 3) + i) % 3) !== 0) rect(bx + 3 + i * 3, by + 3, 2, 2, a.state === 'thinking' ? '#8E5BD6' : '#F29A4B');
        }
        if (a.phase === 'celebrate') {
            const ok = !(a.task && a.task.status === 'error'), c = ok ? '#FFD36B' : '#EC5E8B';
            [[-8, -4], [9, -2], [0, -9]].forEach(([dx, dy], i) => { const f = (Math.floor(a.t * 6) + i) % 2; rect(sx + dx, top + dy, 1 + f, 1 + f, c); dot(sx + dx - 1, top + dy, c); dot(sx + dx + 1, top + dy, c); });
        }
    }

    /* ---------- เรนเดอร์ ---------- */
    const labelEls = {};
    function buildLabels() {
        const wrap = $('officeLabels');
        wrap.innerHTML = '';
        rt.forEach(a => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'of-label'; b.dataset.id = a.def.id;
            const n = document.createElement('b'); n.textContent = a.def.name;
            const s = document.createElement('small');
            const dt = document.createElement('span'); dt.className = 'of-dot';
            const tx = document.createElement('span');
            s.append(dt, tx); b.append(n, s); wrap.appendChild(b);
            b.addEventListener('click', () => selectAgent(a.def.id));
            labelEls[a.def.id] = { b, dot: dt, tx };
            a.label = labelEls[a.def.id];
        });
    }
    function updateLabels() {
        rt.forEach(a => {
            const [sx, sy] = proj(a.x + .5, a.y + (a.sit ? .34 : .5), 0);
            const L = a.label;
            L.b.style.left = (sx / W * 100).toFixed(2) + '%';
            L.b.style.top = ((sy - (a.sit ? 24 : 22) - (a.state === 'working' || a.state === 'thinking' ? 0 : 0)) / H * 100).toFixed(2) + '%';
            if (a.lastState !== a.state) {
                a.lastState = a.state;
                L.tx.textContent = STATE_ICON[a.state] + STATE_TH[a.state];
                L.dot.style.background = STATE_COLOR[a.state];
            }
        });
    }
    function drawBoard() {
        const col = { queued: '#C9C9C9', working: '#FFD36B', done: '#A8E6A1', error: '#EC5E8B', interrupted: '#D8D8D8' };
        cfg.tasks.slice(0, 8).forEach((t, i) => {
            const x0 = 4.64 + (i % 4) * .6, z1 = 32 - Math.floor(i / 4) * 8.5, c = col[t.status] || '#ddd';
            decalL(0, x0, x0 + .5, z1 - 6.5, z1, c);
            lineL(0, x0, z1, x0 + .5, z1, mix(c, '#FFFFFF', .55)); lineL(0, x0 + .06, z1 - 3, x0 + .4, z1 - 3, mix(c, '#2A1A2E', .3)); lineL(0, x0 + .06, z1 - 4.8, x0 + .3, z1 - 4.8, mix(c, '#2A1A2E', .3));
            dotAt(x0 + .25, 0, z1 - .2, '#EC5E8B');
        });
    }

    let renderT = 0;
    function render() {
        renderT = performance.now() / 1000;
        mainCtx.drawImage(bgCanvas, 0, 0);
        drawBoard();
        const items = statics.concat(dyn.map(i => ({ d: i.d, fn: () => i.fn(renderT) })))
            .concat(rt.map(a => ({ d: a.x + a.y + 1.02 + (a.sit ? .2 : 0), fn: () => drawAgent(a) })));
        items.sort((p, q) => p.d - q.d);
        items.forEach(i => i.fn());
        updateLabels();
    }

    /* ---------- ลูปแอนิเมชัน (รันเฉพาะตอนเปิดหน้านี้) ---------- */
    let raf = 0, last = 0, running = false, tabOpen = false;
    function loop(ts) {
        if (!running) return;
        const dt = Math.min(0.1, (ts - last) / 1000 || 0);
        last = ts;
        rt.forEach(a => update(a, dt));
        render();
        raf = requestAnimationFrame(loop);
    }
    function start() { if (running || !tabOpen || document.hidden) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });

    /* ---------- UI: ส่วนสั่งงาน/รายการงาน ---------- */
    let selected = AGENTS[0].id;
    function selectAgent(id) {
        selected = id;
        $('officeAgentSelect').value = id;
        Object.values(labelEls).forEach(L => L.b.classList.toggle('sel', L.b.dataset.id === id));
        const a = AGENTS.find(x => x.id === id);
        $('officeAgentRole').textContent = a ? a.role : '';
    }
    function assign(agentId, text) {
        const t = { id: 'ot_' + Date.now() + '_' + Math.floor(Math.random() * 1000), agentId, text, status: 'queued', createdAt: Date.now() };
        cfg.tasks.unshift(t);
        if (cfg.tasks.length > 60) cfg.tasks.length = 60;
        save(); renderTasks();
        toast('📋 มอบหมายงานให้ ' + AGENTS.find(a => a.id === agentId).name + ' แล้ว');
    }
    function fmtTime(ms) { return ms ? new Date(ms).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''; }

    function renderTasks() {
        const list = $('officeTaskList');
        if (!list) return;
        list.innerHTML = '';
        $('officeModeBadge').textContent = cfg.apiUrl ? '🟢 เชื่อม AI แล้ว' : '🟡 โหมดจำลอง (ยังไม่เชื่อม AI)';
        if (!cfg.tasks.length) {
            const e = document.createElement('div');
            e.className = 'text-center py-6 text-gray-400 text-xs';
            e.textContent = 'ยังไม่มีงาน — ลองสั่งงานพนักงานดูสิ ✨';
            list.appendChild(e);
            return;
        }
        cfg.tasks.forEach(t => {
            const ag = AGENTS.find(a => a.id === t.agentId);
            const card = document.createElement('div');
            card.className = 'of-task bg-offWhite text-darkText space-y-1';

            const head = document.createElement('div');
            head.className = 'flex items-center justify-between gap-2 text-[10px] font-bold';
            const who = document.createElement('span'); who.textContent = `${ag.name} · ${fmtTime(t.createdAt)}`;
            const badge = document.createElement('span');
            badge.className = `px-2 py-0.5 rounded-full border border-darkText ${TASK_CLS[t.status] || ''}`;
            badge.textContent = TASK_TH[t.status] || t.status;
            head.append(who, badge);

            const txt = document.createElement('p');
            txt.className = 'text-xs font-bold break-words'; txt.textContent = t.text;
            card.append(head, txt);

            if (t.result) {
                const det = document.createElement('details');
                det.open = t.status === 'done' && cfg.tasks[0] === t;
                const sum = document.createElement('summary');
                sum.className = 'text-[11px] font-bold text-popBlue cursor-pointer';
                sum.textContent = t.status === 'error' ? 'ดูสาเหตุ' : 'ดูผลงาน';
                const res = document.createElement('div'); res.className = 'of-result'; res.textContent = t.result;
                det.append(sum, res); card.appendChild(det);
            }

            const act = document.createElement('div');
            act.className = 'flex gap-1.5 pt-1';
            const mk = (label, fn, cls) => {
                const b = document.createElement('button'); b.type = 'button';
                b.className = `text-[10px] font-bold px-2 py-0.5 rounded border border-darkText ${cls}`;
                b.textContent = label; b.addEventListener('click', fn); act.appendChild(b);
            };
            if (t.result) mk('คัดลอก', () => { try { navigator.clipboard.writeText(t.result); toast('คัดลอกผลงานแล้ว'); } catch (e) { toast('คัดลอกไม่สำเร็จ'); } }, 'bg-limeGreen');
            if (t.status === 'error' || t.status === 'interrupted') mk('ทำใหม่', () => { t.status = 'queued'; delete t.result; save(); renderTasks(); }, 'bg-sunnyYellow');
            if (t.status !== 'working') mk('ลบ', () => { cfg.tasks = cfg.tasks.filter(k => k !== t); save(); renderTasks(); }, 'bg-white');
            card.appendChild(act);
            list.appendChild(card);
        });
    }

    function meeting() {
        let i = 0;
        rt.forEach(a => {
            if (a.task || a.path.length) return;
            const s = MEETING[i++ % MEETING.length];
            goTo(a, s[0], s[1]);
            a.idleT = 8;
        });
        toast('📣 เรียกประชุมแล้ว');
    }

    function init() {
        load();
        buildBackground();
        buildFurniture();
        buildLabels();

        const sel = $('officeAgentSelect');
        AGENTS.forEach(a => { const o = document.createElement('option'); o.value = a.id; o.textContent = `${a.name} — ${a.role}`; sel.appendChild(o); });
        sel.addEventListener('change', () => selectAgent(sel.value));
        selectAgent(selected);

        $('officeForm').addEventListener('submit', e => {
            e.preventDefault();
            const text = $('officeTaskInput').value.trim().slice(0, 2000);
            if (!text) { toast('พิมพ์งานที่จะสั่งก่อนนะ'); return; }
            assign(sel.value, text);
            $('officeTaskInput').value = '';
        });
        $('officeMeetingBtn').addEventListener('click', meeting);
        $('officeClearDone').addEventListener('click', () => {
            cfg.tasks = cfg.tasks.filter(t => t.status === 'queued' || t.status === 'working');
            save(); renderTasks();
        });

        cfg.apiUrl = API_URL;
        save();

        renderTasks();
        render(); // วาดเฟรมแรกให้เห็นทันที

        // ผูกกับ switchTab เดิมโดยไม่แก้โค้ดต้นฉบับ
        const base = window.switchTab;
        if (typeof base === 'function') {
            window.switchTab = function (id) {
                const r = base.apply(this, arguments);                tabOpen = id === 'office';
                if (tabOpen) start(); else stop();
                return r;
            };
        }
    }

    try {
        init();
        document.documentElement.dataset.officeRenderer = 'loaded';
    } catch (error) {
        console.error('[MY LITTLE OFFICE]', error);
        const stage = document.querySelector('#tab-office .of-stage');
        if (stage) {
            stage.innerHTML = '<div style="padding:16px;color:#3b2a22;background:#fff8f0;font:14px sans-serif;white-space:pre-wrap">ออฟฟิศหยุดตอนเริ่มวาดฉาก: ' + String(error && error.stack || error) + '</div>';
        }
    }
})();