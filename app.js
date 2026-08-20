````javascript
const DB_NAME = 'ai-card-db-v6', STORE = 'cards';
let cards = [], page = 'home', tesseractWorker = null, currentPhoto = '';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 資料庫操作
const dbOp = async (type, data) => {
    const db = await new Promise(res => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = e => res(e.target.result);
    });
    const tx = db.transaction(STORE, (type === 'get' || type === 'getAll') ? 'readonly' : 'readwrite');
    const store = tx.objectStore(STORE);
    return new Promise(res => {
        const req = type === 'get' ? store.get(data) : type === 'getAll' ? store.getAll() : type === 'put' ? store.put(data) : store.delete(data);
        req.onsuccess = e => res(e.target.result);
    });
};

const loadAll = async () => { cards = await dbOp('getAll'); render(); };

function render() {
    if (page === 'home') {
        const listHtml = cards.slice().reverse().slice(0, 5).map(c => `
            <div class="card" onclick="detail('${c.id}')">
                <div class="avatar">${c.photo ? `<img src="${c.photo}">` : '👤'}</div>
                <div class="cm">
                    <div class="cn">${esc(c.name)}</div>
                    <div class="co">${esc(c.company)}</div>
                </div>
            </div>`).join('') || '<p style="text-align:center;color:#94a3b8">尚無名片</p>';

        $('#main').innerHTML = `
            <div style="margin-bottom:20px"><h2>最近名片</h2></div>
            <div id="list">${listHtml}</div>
            <button class="fab" onclick="$('#fileInput').click()">📷</button>
            <input type="file" id="fileInput" accept="image/*" capture="environment" hidden onchange="handleFile(event)">
        `;
    }
}

async function handleFile(event) {
    const file = event.target.files;
    if (!file) return;
    $('#modal').innerHTML = '<div class="modalbg"><div class="modalbox"><h2>🤖 辨識中...</h2><p>正在使用 iPhone 影像優化...</p></div></div>';
    
    const img = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1000; canvas.height = 625;
    ctx.filter = 'contrast(1.4) grayscale(1)'; // 高對比預處理
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, 1000, 625);
    currentPhoto = canvas.toDataURL('image/jpeg', 0.8);

    if (!tesseractWorker) {
        if (!window.Tesseract) {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            await new Promise(res => { s.onload = res; document.head.appendChild(s); });
        }
        tesseractWorker = await Tesseract.createWorker('eng+chi_tra');
    }
    const { data: { text } } = await tesseractWorker.recognize(currentPhoto);
    showResult(text);
}

function parse(t) {
    const lines = t.split('\n').map(l => l.trim()).filter(l => l.length > 1);
    const fullText = lines.join(' ');
    return {
        id: Date.now().toString(),
        name: lines.find(l => /^[\u4e00-\u9fff]{2,4}$/.test(l)) || lines || '未知姓名',
        company: lines.find(l => /(公司|科技|銀行|Co\.|Ltd|Inc)/i.test(l)) || '',
        phone: (fullText.match(/(?:09\d{2}[- ]?\d{3}[- ]?\d{3}|0\d[- ]?\d{3,4}[- ]?\d{3,4})/) || ['']),
        photo: currentPhoto
    };
}

function showResult(text) {
    const p = parse(text);
    $('#modal').innerHTML = `
        <div class="modalbg">
            <div class="modalbox">
                <h2>確認資料</h2>
                <input id="f_name" value="${esc(p.name)}" style="width:100%;margin-bottom:10px;padding:8px">
                <input id="f_company" value="${esc(p.company)}" style="width:100%;margin-bottom:10px;padding:8px">
                <input id="f_phone" value="${esc(p.phone)}" style="width:100%;margin-bottom:10px;padding:8px">
                <button onclick="save()" style="width:100%;padding:12px;background:#2563eb;color:white;border:none;border-radius:8px">儲存</button>
            </div>
        </div>`;
}

async function save() {
    const card = { id: Date.now().toString(), name: $('#f_name').value, company: $('#f_company').value, phone: $('#f_phone').value, photo: currentPhoto };
    await dbOp('put', card);
    $('#modal').innerHTML = '';
    loadAll();
}

function detail(id) {
    const c = cards.find(x => x.id === id);
    $('#modal').innerHTML = `<div class="modalbg" onclick="this.parentElement.innerHTML=''"><div class="modalbox" onclick="event.stopPropagation()">
        <img src="${c.photo}" style="width:100%;border-radius:10px;margin-bottom:10px">
        <h3>${esc(c.name)}</h3><p>${esc(c.company)}</p><p>📞 ${esc(c.phone)}</p>
    </div></div>`;
}

// AI 名片管家 
loadAll();
```




``javascriptPro - v6.0 (app-6.js) - 全新架構
const DB_NAME = 'ai-card-db-v6', STORE = 'cards';
let cards = [], page = 'home', tesseractWorker = null;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- 1. 資料庫與初始化 (Source [7]) ---
const dbOp = async (type, data) => {
    const db = await new Promise((res) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = e => res(e.target.result);
    });
    const tx = db.transaction(STORE, (type === 'get' || type === 'getAll') ? 'readonly' : 'readwrite');
    const store = tx.objectStore(STORE);
    return new Promise(res => {
        const req = type === 'get' ? store.get(data) : type === 'getAll' ? store.getAll() : type === 'put' ? store.put(data) : store.delete(data);
        req.onsuccess = e => res(e.target.result);
    });
};

const loadAll = async () => { cards = await dbOp('getAll'); render(); };

// --- 2. 介面渲染 (修正 Source [1-3, 8] 的語法錯誤) ---
function render() {
    const listHtml = cards.slice().reverse().map(c => `
        <div class="card" onclick="detail('${c.id}')">
            <div class="avatar">${c.photo ? `<img src="${c.photo}">` : '👤'}</div>
            <div class="cm">
                <div class="cn">${esc(c.name)}</div>
                <div class="co">${esc(c.company)}</div>
            </div>
        </div>
    `).join('') || '<p class="empty">尚無名片，請點擊下方拍照</p>';

    $('#main').innerHTML = `
        <div class="search">🔍 <input id="q" placeholder="快速搜尋..."></div>
        <div class="stats"><div class="stat"><div class="num">${cards.length}</div><div class="muted">總張數</div></div></div>
        <div id="list">${listHtml}</div>
        <button class="fab" onclick="$('#fileInput').click()">📷</button>
        <input type="file" id="fileInput" accept="image/*" capture="environment" hidden onchange="handleFile(event)">
    `;
}

// --- 3. 核心辨識邏輯 (Source [4, 6] 優化版) ---
async function handleFile(event) {
    const file = event.target.files;
    if (!file) return;

    // 顯示辨識中 UI
    $('#modal').innerHTML = '<div class="modalbg"><div class="modalbox"><h2>🤖 正在讀取名片...</h2><p>iPhone 影像處理中</p></div></div>';
    
    // 預處理圖片以利 OCR (Source [4, 6])
    const img = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1000; canvas.height = 625;
    ctx.filter = 'contrast(1.5) grayscale(1)'; // 強制轉黑白高對比
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, 1000, 625);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

    // 啟動 OCR (Source [4])
    if (!tesseractWorker) {
        if (!window.Tesseract) {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            await new Promise(res => { s.onload = res; document.head.appendChild(s); });
        }
        tesseractWorker = await Tesseract.createWorker('eng+chi_tra');
    }

    const { data: { text } } = await tesseractWorker.recognize(dataUrl);
    showResult(dataUrl, text);
}

// --- 4. 解析與結果確認 (加強容錯 [2, 6]) ---
function parse(t) {
    const lines = t.split('\n').map(l => l.trim()).filter(l => l.length > 1);
    const fullText = lines.join(' ');
    
    // 更靈活的搜尋邏輯
    return {
        id: Date.now().toString(),
        name: lines.find(l => /^[\u4e00-\u9fff]{2,4}$/.test(l)) || lines || '未辨識出姓名',
        company: lines.find(l => /(公司|科技|銀行|Co\.|Ltd|Inc)/i.test(l)) || '',
        phone: (fullText.match(/(?:09\d{2}[- ]?\d{3}[- ]?\d{3}|0\d[- ]?\d{3,4}[- ]?\d{3,4})/) || ['']),
        email: (fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || ['']),
        photo: currentPhoto || '',
        note: lines.slice(0, 5).join(' ')
    };
}

let currentPhoto = '';
function showResult(photo, text) {
    currentPhoto = photo;
    const p = parse(text);
    $('#modal').innerHTML = `
        <div class="modalbg">
            <div class="modalbox">
                <div class="mh"><h2>確認名片資料</h2><button onclick="closeModal()">✕</button></div>
                <div class="field"><label>姓名</label><input id="f_name" value="${esc(p.name)}"></div>
                <div class="field"><label>公司</label><input id="f_company" value="${esc(p.company)}"></div>
                <div class="field"><label>電話</label><input id="f_phone" value="${esc(p.phone)}"></div>
                <button class="primary" onclick="save()">💾 儲存名片</button>
            </div>
        </div>`;
}

async function save() {
    const newCard = {
        id: Date.now().toString(),
        name: $('#f_name').value,
        company: $('#f_company').value,
        phone: $('#f_phone').value,
        photo: currentPhoto
    };
    await dbOp('put', newCard);
    $('#modal').innerHTML = '';
    loadAll();
}

function closeModal() { $('#modal').innerHTML = ''; }

// 啟動
loadAll();
```
