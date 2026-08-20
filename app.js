```javascript
// AI 名片管家 Pro - v2.0 (app-2.js)
const DB_NAME = 'ai-card-db-v2', STORE = 'cards';
let cards = [], page = 'home', stream = null;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const initial = c => (c.name || '?').trim() || '?';

// --- 1. IndexedDB 核心儲存 (解決 5MB 限制) ---
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

// --- 2. 介面渲染邏輯 ---
function row(c) {
    return `<button class="card" data-id="${c.id}"><div class="avatar">${c.photo ? `<img src="${c.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : esc(initial(c))}</div><div class="cm"><div class="cn">${esc(c.name || '未命名')} ${c.favorite ? '★' : ''}</div><div class="co">${esc(c.company || '未填寫公司')}</div><div class="job">${esc(c.jobTitle || '')}</div></div><div class="arrow">›</div></button>`;
}

function bind() { document.querySelectorAll('[data-id]').forEach(x => x.onclick = () => detail(x.dataset.id)); }

function render() {
    if (page === 'home') home();
    else if (page === 'cards') cardsPage();
    else if (page === 'cats') cats();
    else settings();
    document.querySelectorAll('nav button[data-page]').forEach(x => x.classList.toggle('active', x.dataset.page === page));
}

function home() {
    $('#main').innerHTML = `<div class="search">🔍 <input id="q" placeholder="搜尋姓名、公司、電話…"></div><button class="hero" id="scan"><div class="cam">📷</div><h2>拍攝名片</h2><p>啟動 iPhone 原生相機拍照辨識</p></button><div class="stats"><div class="stat"><div class="num">${cards.length}</div><div class="muted">全部</div></div><div class="stat"><div class="num">${cards.filter(x => x.favorite).length}</div><div class="muted">最愛</div></div></div><div class="title"><h2>最近新增</h2></div><div id="list">${cards.slice().reverse().slice(0, 8).map(row).join('') || '<p class="empty">📇 尚無名片</p>'}</div>`;
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

function cats() {
    let ns = ['我的最愛', '壽險', '產險', '投信', '銀行', '票券', '證券', '政府', '公司', '其他'];
    $('#main').innerHTML = '<div class="title"><h2>分類</h2></div>' + ns.map(n => `<button class="cat" data-cat="${n}">🏷️ <b>${n}</b><span class="count">${n === '我的最愛' ? cards.filter(x => x.favorite).length : cards.filter(x => x.category === n).length}</span>›</button>`).join('');
    document.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
        let n = b.dataset.cat, f = n === '我的最愛' ? cards.filter(x => x.favorite) : cards.filter(x => x.category === n);
        $('#main').innerHTML = `<div class="title"><h2>${n}</h2></div>${f.map(row).join('') || '<p class="empty">無資料</p>'}`;
        bind();
    });
}

// --- 3. 掃描與 OCR (優化原生拍照與解析) ---
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
    let phoneMatch = a.match(/(?:09\d{2}[- ]?\d{3}[- ]?\d{3}|0\d[- ]?\d{3,4}[- ]?\d{3,4})/);
    let phone = phoneMatch ? phoneMatch : '';
    let ext = (a.match(/(?:分機|ext|#)\s*(\d+)/i) || [])[1] || '';
    let taxId = (a.match(/\b\d{8}\b/) || []) || '';
    let address = l.find(x => /(市|縣|區|路|街|巷|號|樓)/.test(x)) || '';
    let name = l.find(x => /^[\u4e00-\u9fff]{2,4}$/.test(x)) || '';
    let company = l.find(x => /(有限公司|股份有限公司|公司|科技|電子|銀行|集團|Co.|Ltd|Inc)/i.test(x)) || '';
    
    const jobList = ['董事長', '總經理', '副總經理', '資深副總經理', '資深協理', '協理', '資深經理', '經理', '副理', '襄理', '資深專員', '專員', '主任', '董事'];
    let job = jobList.find(j => a.includes(j)) || '';

    return { name, company, taxId, jobTitle: job, phone, ext, email, address, category: '其他', note: '' };
}

// --- 4. 編輯、詳細與 vCard 匯出 ---
function input(label, k, v, type = 'text', options = []) {
    let field = `<div class="field ${['name', 'company', 'address', 'note'].includes(k) ? 'full' : ''}"><label>${label}</label>`;
    if (type === 'select') {
        field += `<select id="f_${k}">${options.map(o => `<option value="${o}" ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    } else if (k === 'note') {
        field += `<textarea id="f_${k}">${esc(v)}</textarea>`;
    } else {
        field += `<input id="f_${k}" value="${esc(v)}">`;
    }
    return field + `</div>`;
}

function showResult(src, text, existingCard = null) {
    let p = existingCard || parse(text);
    const catList = ['壽險', '產險', '投信', '銀行', '票券', '證券', '政府', '公司', '其他'];
    const jobList = ['董事長', '總經理', '副總經理', '資深副總經理', '資深協理', '協理', '資深經理', '經理', '副理', '襄理', '資深專員', '專員', '主任', '董事'];

    $('#modal').innerHTML = `<div class="modalbg"><div class="modalbox"><div class="mh"><h2>${existingCard ? '✏️ 編輯名片' : '🤖 辨識結果'}</h2><button class="close" onclick="closeModal()">✕</button></div><img class="preview" src="${src}"><div class="grid">${input('姓名', 'name', p.name)}${input('公司', 'company', p.company)}${input('統編', 'taxId', p.taxId)}${input('職稱', 'jobTitle', p.jobTitle, 'select', jobList)}${input('電話', 'phone', p.phone)}${input('分機', 'ext', p.ext)}${input('Email', 'email', p.email)}${input('地址', 'address', p.address)}${input('分類', 'category', p.category, 'select', catList)}${input('備註', 'note', p.note)}</div><button class="primary" id="saveBtn">✓ 儲存名片</button></div></div>`;
    
    $('#saveBtn').onclick = async () => {
        let g = k => $('#f_' + k)?.value.trim() || '';
        if (!g('name')) return alert('請補上姓名');
        const newCard = { id: existingCard?.id || Date.now().toString(), name: g('name'), company: g('company'), taxId: g('taxId'), jobTitle: g('jobTitle'), phone: g('phone'), ext: g('ext'), email: g('email'), address: g('address'), category: g('category'), favorite: p.favorite || false, photo: src, note: g('note'), updatedAt: new Date().toISOString() };
        await saveToDB(newCard);
        closeModal();
        loadAll();
    };
}

async function detail(id) {
    let c = cards.find(x => x.id === id);
    let displayPhone = c.phone + (c.ext ? ' #' + c.ext : '');
    $('#modal').innerHTML = `<div class="modalbg"><div class="modalbox"><div class="mh"><h2>名片詳情</h2><button class="close" onclick="closeModal()">✕</button></div><div style="text-align:center"><img class="preview" src="${c.photo}"><h2>${esc(c.name)} ${c.favorite ? '★' : ''}</h2><p><b>${esc(c.company)}</b> ${c.taxId ? `(統編: ${esc(c.taxId)})` : ''}<br>${esc(c.jobTitle)}</p></div><div class="actions"><button class="action" onclick="location.href='tel:${esc(c.phone)}'">📞<span>打電話</span></button><button class="action" onclick="exportVCard('${c.id}')">📇<span>存入手機</span></button><button class="action" onclick="location.href='mailto:${esc(c.email)}'">✉️<span>Email</span></button></div><button class="primary" id="editBtn">✏️ 編輯資訊</button><button class="primary" id="favBtn">${c.favorite ? '☆ 取消最愛' : '★ 加入最愛'}</button><button class="primary" id="delBtn" style="background:#fee2e2;color:#b91c1c">🗑️ 刪除名片</button></div></div>`;
    $('#editBtn').onclick = () => showResult(c.photo, '', c);
    $('#favBtn').onclick = async () => { c.favorite = !c.favorite; await saveToDB(c); closeModal(); loadAll(); };
    $('#delBtn').onclick = async () => { if (confirm('確定刪除？')) { await dbOp('delete', id); closeModal(); loadAll(); } };
}

function exportVCard(id) {
    let c = cards.find(x => x.id === id);
    let v = `BEGIN:VCARD\nVERSION:3.0\nFN:${c.name}\nORG:${c.company}\nTITLE:${c.jobTitle}\nTEL:${c.phone}${c.ext ? ',' + c.ext : ''}\nEMAIL:${c.email}\nADR:;;${c.address};;;;\nNOTE:統編:${c.taxId}\nEND:VCARD`;
    let a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([v], { type: 'text/vcard' }));
    a.download = `${c.name}.vcf`; a.click();
}

function closeModal() { $('#modal').innerHTML = ''; }

function settings() {
    $('#main').innerHTML = `<div class="title"><h2>設定</h2></div><div class="panel" style="padding:15px"><p>V2.0 診斷</p><div>HTTPS：<b>${location.protocol === 'https:' ? '✓' : '✕'}</b></div><br><button class="secondary" onclick="exportData()">匯出 JSON 備份</button></div>`;
}

function exportData() {
    let a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(cards, null, 2)], { type: 'application/json' }));
    a.download = 'ai-card-backup.json'; a.click();
}

// --- 5. 初始化 ---
document.querySelectorAll('nav button[data-page]').forEach(b => b.onclick = () => { page = b.dataset.page; render(); });
loadAll();
```
