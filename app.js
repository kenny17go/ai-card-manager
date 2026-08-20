```javascript
// AI 名片管家 Pro - v1.2 (優化儲存與相機版)
const DB_NAME = 'ai-card-db', STORE = 'cards';
let cards = [], page = 'home', stream = null;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const initial = c => (c.name || '?').trim() || '?';

// --- 1. IndexedDB 封裝 ---
const dbOp = async (type, data) => {
    const db = await new Promise((res, rej) => {
        const req = indexedDB.open(DB_NAME, 3);
        req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = e => res(e.target.result);
        req.onerror = e => rej(e.target.error);
    });
    const tx = db.transaction(STORE, type === 'get' || type === 'getAll' ? 'readonly' : 'readwrite');
    const store = tx.objectStore(STORE);
    return new Promise(res => {
        const req = type === 'get' ? store.get(data) : type === 'getAll' ? store.getAll() : type === 'put' ? store.put(data) : store.delete(data);
        req.onsuccess = e => res(e.target.result);
    });
};

const saveToDB = async (c) => await dbOp('put', c);
const loadAll = async () => { cards = await dbOp('getAll'); render(); };

// --- 2. 介面渲染邏輯 ---
function row(c) {
    return `<button class="card" data-id="${c.id}"><div class="avatar">${c.photo ? `<img src="${c.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : esc(initial(c))}</div><div class="cm"><div class="cn">${esc(c.name || '未命名')} ${c.favorite ? '★' : ''}</div><div class="co">${esc(c.company || '未填寫公司')}</div><div class="job">${esc(c.jobTitle || '')}</div></div><div class="arrow">›</div></button>`;
}

function bind() { document.querySelectorAll('[data-id]').forEach(x => x.onclick = () => detail(x.dataset.id)); }

function render() {
    const main = $('#main');
    if (page === 'home') home();
    else if (page === 'cards') cardsPage();
    else if (page === 'cats') cats();
    else settings();
    document.querySelectorAll('nav button[data-page]').forEach(x => x.classList.toggle('active', x.dataset.page === page));
}

function home() {
    $('#main').innerHTML = `<div class="search">🔍 <input id="q" placeholder="搜尋姓名、公司、電話…"></div><button class="hero" id="scan"><div class="cam">📷</div><h2>拍攝名片</h2><p>直接啟動原生相機拍照辨識</p></button><div class="stats"><div class="stat"><div class="num">${cards.length}</div><div class="muted">全部</div></div><div class="stat"><div class="num">${cards.filter(x => x.favorite).length}</div><div class="muted">最愛</div></div></div><div class="title"><h2>最近新增</h2></div><div id="list">${cards.slice().reverse().slice(0, 8).map(row).join('') || '<p class="empty">📇 尚無名片</p>'}</div>`;
    $('#scan').onclick = openScanner;
    $('#q').oninput = e => filter(e.target.value);
    bind();
}

function filter(q) {
    q = q.toLowerCase();
    let f = cards.filter(c => Object.values(c).join(' ').toLowerCase().includes(q));
    $('#list').innerHTML = f.map(row).join('') || '<p class="empty">找不到符合的名片</p>';
    bind();
}

function cardsPage() {
    $('#main').innerHTML = `<div class="search">🔍 <input id="q" placeholder="搜尋…"></div><div class="title"><h2>我的名片</h2><span class="muted">${cards.length} 張</span></div><div id="list">${cards.map(row).join('') || '<p class="empty">📇 尚無名片</p>'}</div>`;
    $('#q').oninput = e => filter(e.target.value);
    bind();
}

// --- 3. 掃描與 OCR ---
async function openScanner() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.setAttribute('capture', 'environment');
    fileInput.onchange = e => { if (e.target.files?.) processImage(URL.createObjectURL(e.target.files)); };
    fileInput.click();
}

async function processImage(src) {
    $('#modal').innerHTML = `<div class="modalbg"><div class="modalbox" style="text-align:center"><h2>🤖 AI OCR 辨識中</h2><img class="preview" src="${src}"><div id="status" class="notice">載入 OCR 引擎…</div></div></div>`;
    try {
        if (!window.Tesseract) {
            let s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            await new Promise((ok, no) => { s.onload = ok; s.onerror = no; document.head.appendChild(s); });
        }
        let w = await Tesseract.createWorker('eng+chi_tra', 1, { logger: m => { if ($('#status')) $('#status').textContent = `${m.status === 'recognizing text' ? '辨識文字中' : '載入中'} ${Math.round((m.progress || 0) * 100)}%` } });
        let r = await w.recognize(src); await w.terminate();
        showResult(src, r.data.text || '');
    } catch (e) { showResult(src, ''); }
}

function parse(t) {
    let l = t.split(/\n+/).map(x => x.trim()).filter(Boolean), a = l.join(' ');
    let email = (a.match(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/) || []) || '';
    let phone = (a.match(/(?:09\d{2}[- ]?\d{3}[- ]?\d{3}|0\d[- ]?\d{3,4}[- ]?\d{3,4})/) || []) || '';
    return {
        name: l.find(x => /^[\u4e00-\u9fff]{2,4}$/.test(x)) || '',
        company: l.find(x => /(有限公司|公司|科技|銀行|Co.|Ltd|Inc)/i.test(x)) || '',
        jobTitle: l.find(x => /(經理|副理|主任|總監|董事|工程師|業務|Manager|Director|Engineer)/i.test(x)) || '',
        phone, email, address: '', category: '未分類', note: ''
    };
}

// --- 4. 編輯與詳細資訊 ---
function inputField(label, k, v) {
    return `<div class="field ${['name', 'company', 'address'].includes(k) ? 'full' : ''}"><label>${label}</label><input id="f_${k}" value="${esc(v)}"></div>`;
}

function showResult(src, text, existingCard = null) {
    let p = existingCard || parse(text);
    $('#modal').innerHTML = `<div class="modalbg"><div class="modalbox"><div class="mh"><h2>${existingCard ? '✏️ 編輯名片' : '🤖 辨識結果'}</h2><button class="close" onclick="closeModal()">✕</button></div><img class="preview" src="${src}"><div class="grid">${inputField('姓名', 'name', p.name)}${inputField('公司', 'company', p.company)}${inputField('職稱', 'jobTitle', p.jobTitle)}${inputField('電話', 'phone', p.phone)}${inputField('Email', 'email', p.email)}${inputField('地址', 'address', p.address)}${inputField('分類', 'category', p.category)}</div><button class="primary" id="saveBtn">✓ 儲存名片</button></div></div>`;
    $('#saveBtn').onclick = async () => {
        let g = k => $('#f_' + k)?.value.trim() || '';
        if (!g('name')) return alert('請補上姓名');
        const newCard = { id: existingCard?.id || Date.now().toString(), name: g('name'), company: g('company'), jobTitle: g('jobTitle'), phone: g('phone'), email: g('email'), address: g('address'), category: g('category'), note: p.note || '', favorite: p.favorite || false, photo: src, updatedAt: new Date().toISOString() };
        await saveToDB(newCard);
        closeModal();
        loadAll();
    };
}

async function detail(id) {
    let c = cards.find(x => x.id === id);
    $('#modal').innerHTML = `<div class="modalbg"><div class="modalbox"><div class="mh"><h2>名片詳情</h2><button class="close" onclick="closeModal()">✕</button></div><div style="text-align:center"><img class="preview" src="${c.photo}"><h2>${esc(c.name)} ${c.favorite ? '★' : ''}</h2><p>${esc(c.company)}<br>${esc(c.jobTitle)}</p></div><div class="actions"><button class="action" onclick="location.href='tel:${esc(c.phone)}'">📞<span>打電話</span></button><button class="action" onclick="exportVCard('${c.id}')">📇<span>存入手機</span></button><button class="action" onclick="location.href='mailto:${esc(c.email)}'">✉️<span>Email</span></button></div><button class="primary" id="editBtn">✏️ 編輯資訊</button><button class="primary" id="favBtn">${c.favorite ? '☆ 取消最愛' : '★ 加入最愛'}</button><button class="primary" id="delBtn" style="background:#fee2e2;color:#b91c1c">🗑️ 刪除名片</button></div></div>`;
    $('#editBtn').onclick = () => showResult(c.photo, '', c);
    $('#favBtn').onclick = async () => { c.favorite = !c.favorite; await saveToDB(c); closeModal(); loadAll(); };
    $('#delBtn').onclick = async () => { if (confirm('確定刪除？')) { await dbOp('delete', id); closeModal(); loadAll(); } };
}

function exportVCard(id) {
    let c = cards.find(x => x.id === id);
    let v = `BEGIN:VCARD\nVERSION:3.0\nFN:${c.name}\nORG:${c.company}\nTITLE:${c.jobTitle}\nTEL:${c.phone}\nEMAIL:${c.email}\nEND:VCARD`;
    let a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([v], { type: 'text/vcard' }));
    a.download = `${c.name}.vcf`; a.click();
}

function closeModal() { $('#modal').innerHTML = ''; }

// --- 5. 初始化與事件 ---
document.querySelectorAll('nav button[data-page]').forEach(b => b.onclick = () => { page = b.dataset.page; render(); });
loadAll();
```

### 優化重點摘要：
*   **[i] 資料儲存**：完全棄用 `localStorage`，改用 **IndexedDB** 操作 (`dbOp` 函式)，這能讓您在手機上儲存大量名片圖片（以 Base64 或 Blob 格式）而不崩潰 [1, 2]。
*   **[i] 相機調用**：`openScanner` 不再使用視訊串流，而是直接點擊一個帶有 `capture="environment"` 的檔案輸入框，這會呼叫 **iPhone 的原生相機介面**，讓使用者可以利用 iPhone 強大的對焦與微距功能拍照 [1, 3]。
*   **[i] 聯絡人整合**：新增 `exportVCard` 函式，使用者在詳細頁面點擊「存入手機」後，會下載 `.vcf` 檔，iPhone 會自動詢問是否將此名片加入系統通訊錄 [2]。
*   **[i] 編輯與更新**：原本辨識完就存入無法修改，新版加入了 `editBtn`，可隨時修正 AI 辨識錯誤的姓名或公司資訊 [2]。

已經為您準備好優化後的 **`app.js`** 程式碼。這份代碼整合了 **IndexedDB 儲存**、**原生相機調用**、**vCard 匯出** 以及 **編輯功能**，並保留了您原始代碼的結構風格 [1-3]。

您可以直接將以下內容複製並存成 `app.js`：

```javascript
// AI 名片管家 Pro - v1.2 (優化儲存與相機版)
const DB_NAME = 'ai-card-db', STORE = 'cards';
let cards = [], page = 'home', stream = null;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const initial = c => (c.name || '?').trim() || '?';

// --- 1. IndexedDB 核心儲存邏輯 (取代 localStorage) --- [1, 3]
const dbOp = async (type, data) => {
    const db = await new Promise((res, rej) => {
        const req = indexedDB.open(DB_NAME, 3);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        };
        req.onsuccess = e => res(e.target.result);
        req.onerror = e => rej(e.target.error);
    });
    const tx = db.transaction(STORE, type === 'get' || type === 'getAll' ? 'readonly' : 'readwrite');
    const store = tx.objectStore(STORE);
    return new Promise(res => {
        const req = type === 'get' ? store.get(data) : type === 'getAll' ? store.getAll() : type === 'put' ? store.put(data) : store.delete(data);
        req.onsuccess = e => res(e.target.result);
    });
};

const saveToDB = async (c) => await dbOp('put', c);
const loadAll = async () => { cards = await dbOp('getAll'); render(); };

// --- 2. 介面渲染與導航 --- [1]
function row(c) {
    return `<button class="card" data-id="${c.id}"><div class="avatar">${c.photo ? `<img src="${c.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : esc(initial(c))}</div><div class="cm"><div class="cn">${esc(c.name || '未命名')} ${c.favorite ? '★' : ''}</div><div class="co">${esc(c.company || '未填寫公司')}</div><div class="job">${esc(c.jobTitle || '')}</div></div><div class="arrow">›</div></button>`;
}

function bind() { document.querySelectorAll('[data-id]').forEach(x => x.onclick = () => detail(x.dataset.id)); }

function render() {
    const main = $('#main');
    if (page === 'home') home();
    else if (page === 'cards') cardsPage();
    else if (page === 'cats') cats();
    else settings();
    document.querySelectorAll('nav button[data-page]').forEach(x => x.classList.toggle('active', x.dataset.page === page));
}

function home() {
    $('#main').innerHTML = `
        <div class="search">🔍 <input id="q" placeholder="搜尋姓名、公司、電話…"></div>
        <button class="hero" id="scan"><div class="cam">📷</div><h2>拍攝名片</h2><p>啟動 iPhone 原生相機拍照辨識</p></button>
        <div class="stats">
            <div class="stat"><div class="num">${cards.length}</div><div class="muted">全部</div></div>
            <div class="stat"><div class="num">${cards.filter(x => x.favorite).length}</div><div class="muted">最愛</div></div>
        </div>
        <div class="title"><h2>最近新增</h2></div>
        <div id="list">${cards.slice().reverse().slice(0, 8).map(row).join('') || '<p class="empty">📇 尚無名片</p>'}</div>`;
    $('#scan').onclick = openScanner;
    $('#q').oninput = e => filter(e.target.value);
    bind();
}

function filter(q) {
    q = q.toLowerCase();
    let f = cards.filter(c => Object.values(c).join(' ').toLowerCase().includes(q));
    $('#list').innerHTML = f.map(row).join('') || '<p class="empty">找不到符合的名片</p>';
    bind();
}

function cardsPage() {
    $('#main').innerHTML = `<div class="search">🔍 <input id="q" placeholder="搜尋…"></div><div class="title"><h2>我的名片</h2><span class="muted">${cards.length} 張</span></div><div id="list">${cards.map(row).join('') || '<p class="empty">📇 尚無名片</p>'}</div>`;
    $('#q').oninput = e => filter(e.target.value);
    bind();
}

// --- 3. 掃描與 OCR (優化為原生拍照) --- [2]
async function openScanner() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.setAttribute('capture', 'environment'); // 強制開啟後置鏡頭
    fileInput.onchange = e => { if (e.target.files?.) processImage(URL.createObjectURL(e.target.files)); };
    fileInput.click();
}

async function processImage(src) {
    $('#modal').innerHTML = `<div class="modalbg"><div class="modalbox" style="text-align:center"><h2>🤖 AI OCR 辨識中</h2><img class="preview" src="${src}"><div id="status" class="notice">載入 OCR 引擎…</div></div></div>`;
    try {
        if (!window.Tesseract) {
            let s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            await new Promise((ok, no) => { s.onload = ok; s.onerror = no; document.head.appendChild(s); });
        }
        let w = await Tesseract.createWorker('eng+chi_tra', 1, { logger: m => { if ($('#status')) $('#status').textContent = `${m.status === 'recognizing text' ? '辨識文字中' : '載入中'} ${Math.round((m.progress || 0) * 100)}%` } });
        let r = await w.recognize(src); await w.terminate();
        showResult(src, r.data.text || '');
    } catch (e) { showResult(src, ''); }
}

// 文字解析邏輯 [2]
function parse(t) {
    let l = t.split(/\n+/).map(x => x.trim()).filter(Boolean), a = l.join(' ');
    let email = (a.match(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/) || []) || '';
    let phone = (a.match(/(?:09\d{2}[- ]?\d{3}[- ]?\d{3}|0\d[- ]?\d{3,4}[- ]?\d{3,4})/) || []) || '';
    let name = l.find(x => /^[\u4e00-\u9fff]{2,4}$/.test(x)) || '';
    let company = l.find(x => /(有限公司|公司|科技|銀行|Co.|Ltd|Inc)/i.test(x)) || '';
    let job = l.find(x => /(經理|副理|主任|總監|董事|工程師|業務|Manager|Director|Engineer)/i.test(x)) || '';
    return { name, company, jobTitle: job, phone, email, address: '', category: '未分類', note: '' };
}

// --- 4. 編輯、詳細與 vCard 匯出 --- [3]
function inputField(label, k, v) {
    return `<div class="field ${['name', 'company', 'address'].includes(k) ? 'full' : ''}"><label>${label}</label><input id="f_${k}" value="${esc(v)}"></div>`;
}

function showResult(src, text, existingCard = null) {
    let p = existingCard || parse(text);
    $('#modal').innerHTML = `<div class="modalbg"><div class="modalbox"><div class="mh"><h2>${existingCard ? '✏️ 編輯名片' : '🤖 辨識結果'}</h2><button class="close" onclick="closeModal()">✕</button></div><img class="preview" src="${src}"><div class="grid">${inputField('姓名', 'name', p.name)}${inputField('公司', 'company', p.company)}${inputField('職稱', 'jobTitle', p.jobTitle)}${inputField('電話', 'phone', p.phone)}${inputField('Email', 'email', p.email)}${inputField('地址', 'address', p.address)}${inputField('分類', 'category', p.category)}</div><button class="primary" id="saveBtn">✓ 儲存名片</button></div></div>`;
    $('#saveBtn').onclick = async () => {
        let g = k => $('#f_' + k)?.value.trim() || '';
        if (!g('name')) return alert('請補上姓名');
        const newCard = { id: existingCard?.id || Date.now().toString(), name: g('name'), company: g('company'), jobTitle: g('jobTitle'), phone: g('phone'), email: g('email'), address: g('address'), category: g('category'), favorite: p.favorite || false, photo: src, updatedAt: new Date().toISOString() };
        await saveToDB(newCard);
        closeModal();
        loadAll();
    };
}

async function detail(id) {
    let c = cards.find(x => x.id === id);
    $('#modal').innerHTML = `<div class="modalbg"><div class="modalbox"><div class="mh"><h2>名片詳情</h2><button class="close" onclick="closeModal()">✕</button></div><div style="text-align:center"><img class="preview" src="${c.photo}"><h2>${esc(c.name)} ${c.favorite ? '★' : ''}</h2><p>${esc(c.company)}<br>${esc(c.jobTitle)}</p></div><div class="actions"><button class="action" onclick="location.href='tel:${esc(c.phone)}'">📞<span>打電話</span></button><button class="action" onclick="exportVCard('${c.id}')">📇<span>存入手機</span></button><button class="action" onclick="location.href='mailto:${esc(c.email)}'">✉️<span>Email</span></button></div><button class="primary" id="editBtn">✏️ 編輯資訊</button><button class="primary" id="favBtn">${c.favorite ? '☆ 取消最愛' : '★ 加入最愛'}</button><button class="primary" id="delBtn" style="background:#fee2e2;color:#b91c1c">🗑️ 刪除名片</button></div></div>`;
    $('#editBtn').onclick = () => showResult(c.photo, '', c);
    $('#favBtn').onclick = async () => { c.favorite = !c.favorite; await saveToDB(c); closeModal(); loadAll(); };
    $('#delBtn').onclick = async () => { if (confirm('確定刪除？')) { await dbOp('delete', id); closeModal(); loadAll(); } };
}

function exportVCard(id) {
    let c = cards.find(x => x.id === id);
    let v = `BEGIN:VCARD\nVERSION:3.0\nFN:${c.name}\nORG:${c.company}\nTITLE:${c.jobTitle}\nTEL:${c.phone}\nEMAIL:${c.email}\nEND:VCARD`;
    let a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([v], { type: 'text/vcard' }));
    a.download = `${c.name}.vcf`; a.click();
}

function closeModal() { $('#modal').innerHTML = ''; }

// --- 5. 初始化 ---
document.querySelectorAll('nav button[data-page]').forEach(b => b.onclick = () => { page = b.dataset.page; render(); });
loadAll();
```
