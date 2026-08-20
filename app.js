```javascript
// AI 名片管家 Pro - v3.0 (app-3.js)
const DB_NAME = 'ai-card-db-v3', STORE = 'cards';
let cards = [], page = 'home', stream = null;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const initial = c => (c.name || '?').trim() || '?';

// --- 1. IndexedDB 儲存優化 (取代 localStorage [1]) ---
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

const loadAll = async () => { cards = await dbOp('getAll'); render(); };

// --- 2. 介面渲染與導航 ---
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
    $('#main').innerHTML = `<div class="search">🔍 <input id="q" placeholder="搜尋姓名、公司、電話…"></div><button class="hero" id="scan"><div class="cam">📷</div><h2>拍攝名片</h2><p>自動擷取區域並辨識</p></button><div class="stats"><div class="stat"><div class="num">${cards.length}</div><div class="muted">全部</div></div><div class="stat"><div class="num">${cards.filter(x => x.favorite).length}</div><div class="muted">最愛</div></div></div><div class="title"><h2>最近新增</h2></div><div id="list">${cards.slice().reverse().slice(0, 8).map(row).join('') || '<p class="empty">📇 尚無名片</p>'}</div>`;
    $('#scan').onclick = openScanner;
    $('#q').oninput = e => filter(e.target.value);
    bind();
}

// --- 3. 強化後的影像擷取 (解決只拍整頁的問題 [2]) ---
async function openScanner() {
    $('#modal').innerHTML = `<div class="modalbg"><div class="modalbox"><div class="mh"><h2>📷 掃描名片</h2><button class="close" id="x">✕</button></div><div id="cameraArea"></div><div class="notice">請將名片對準框線。</div><input id="file" type="file" accept="image/*" capture="environment" hidden></div></div>`;
    $('#x').onclick = closeModal;
    startCamera();
}

async function startCamera() {
    const area = $('#cameraArea');
    area.innerHTML = `<div class="camera"><video id="video" autoplay muted playsinline></video><div class="guide"></div></div><button class="shutter" id="shutter">●</button>`;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
        $('#video').srcObject = stream;
        $('#shutter').onclick = capture;
    } catch (e) { alert("無法啟動相機"); }
}

function capture() {
    let v = $('#video'), c = document.createElement('canvas');
    const vW = v.videoWidth, vH = v.videoHeight;
    // 擷取畫面中央 80% 區域，比例設定為 1.6 (名片常用比例)
    const cropW = vW * 0.8, cropH = cropW / 1.6;
    const startX = (vW - cropW) / 2, startY = (vH - cropH) / 2;
    c.width = cropW; c.height = cropH;
    // 僅截取導引框內的影像 [2]
    c.getContext('2d').drawImage(v, startX, startY, cropW, cropH, 0, 0, cropW, cropH);
    let src = c.toDataURL('image/jpeg', 0.9);
    closeModal();
    processImage(src);
}

// --- 4. 強化後的解析邏輯 (增加統編、分機、地址辨識 [2]) ---
function parse(t) {
    let l = t.split(/\n+/).map(x => x.trim()).filter(Boolean), a = l.join(' ');
    // 統編辨識 (8位數字)
    let taxId = (a.match(/\b\d{8}\b/) || ['']);
    // 電話與分機辨識
    let phoneMatch = a.match(/(?:09\d{2}[- ]?\d{3}[- ]?\d{3}|0\d[- ]?\d{3,4}[- ]?\d{3,4})/);
    let ext = (a.match(/(?:分機|ext|#)\s*(\d+)/i) || ['', ''])[1];
    // 地址辨識
    let address = l.find(x => /(市|縣|區|路|街|巷|號|樓)/.test(x)) || '';
    // 姓名與公司
    let name = l.find(x => /^[\u4e00-\u9fff]{2,4}$/.test(x)) || l || '';
    let company = l.find(x => /(有限公司|股份有限公司|公司|科技|銀行|Co.|Ltd|Inc)/i.test(x)) || '';
    
    return { name, company, taxId, phone: phoneMatch ? phoneMatch : '', ext, email: (a.match(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/) || ['']), address, category: '其他', jobTitle: '專員' };
}

// --- 5. 更新後的輸入與顯示介面 (含下拉選單與新欄位 [2, 3]) ---
function input(label, k, v, type = 'text', options = []) {
    let field = `<div class="field ${['name', 'company', 'address', 'note'].includes(k) ? 'full' : ''}"><label>${label}</label>`;
    if (type === 'select') {
        field += `<select id="f_${k}">${options.map(o => `<option value="${o}" ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    } else {
        field += `<input id="f_${k}" value="${esc(v)}">`;
    }
    return field + `</div>`;
}

function showResult(src, text, existingCard = null) {
    let p = existingCard || parse(text);
    const catList = ['壽險', '產險', '投信', '銀行', '票券', '證券', '政府', '公司', '其他'];
    const jobList = ['董事長', '總經理', '副總經理', '資深副總經理', '資深協理', '協理', '資深經理', '經理', '副理', '襄理', '資深專員', '專員', '主任', '董事'];

    $('#modal').innerHTML = `<div class="modalbg"><div class="modalbox"><div class="mh"><h2>🤖 辨識結果</h2><button class="close" onclick="closeModal()">✕</button></div><img class="preview" src="${src}"><div class="grid">
        ${input('姓名', 'name', p.name)} ${input('公司', 'company', p.company)}
        ${input('統編', 'taxId', p.taxId)} ${input('職稱', 'jobTitle', p.jobTitle, 'select', jobList)}
        ${input('電話', 'phone', p.phone)} ${input('分機', 'ext', p.ext)}
        ${input('Email', 'email', p.email)} ${input('地址', 'address', p.address)}
        ${input('分類', 'category', p.category, 'select', catList)}
    </div><button class="primary" id="saveBtn">✓ 儲存名片</button></div></div>`;
    
    $('#saveBtn').onclick = async () => {
        let g = k => $('#f_' + k)?.value.trim() || '';
        if (!g('name')) return alert('請補上姓名');
        const newCard = { id: existingCard?.id || Date.now().toString(), name: g('name'), company: g('company'), taxId: g('taxId'), jobTitle: g('jobTitle'), phone: g('phone'), ext: g('ext'), email: g('email'), address: g('address'), category: g('category'), favorite: p.favorite || false, photo: src, updatedAt: new Date().toISOString() };
        await dbOp('put', newCard);
        closeModal(); loadAll();
    };
}

async function detail(id) {
    let c = cards.find(x => x.id === id);
    $('#modal').innerHTML = `<div class="modalbg"><div class="modalbox"><div class="mh"><h2>名片詳情</h2><button class="close" onclick="closeModal()">✕</button></div><div style="text-align:center"><img class="preview" src="${c.photo}"><h2>${esc(c.name)} ${c.favorite ? '★' : ''}</h2><p><b>${esc(c.company)}</b> ${c.taxId ? `(統編: ${esc(c.taxId)})` : ''}<br>${esc(c.jobTitle)}</p><p>📞 ${esc(c.phone)} ${c.ext ? '分機 '+esc(c.ext) : ''}</p></div><div class="actions"><button class="action" onclick="location.href='tel:${esc(c.phone)}'">📞<span>撥打</span></button><button class="action" onclick="exportVCard('${c.id}')">📇<span>存入手機</span></button></div><button class="primary" id="editBtn">✏️ 編輯</button><button class="primary" id="delBtn" style="background:#fee2e2;color:#b91c1c">🗑️ 刪除</button></div></div>`;
    $('#editBtn').onclick = () => showResult(c.photo, '', c);
    $('#delBtn').onclick = async () => { if (confirm('確定刪除？')) { await dbOp('delete', id); closeModal(); loadAll(); } };
}

// 輔助功能：vCard 匯出與影像處理
function exportVCard(id) {
    let c = cards.find(x => x.id === id);
    let v = `BEGIN:VCARD\nVERSION:3.0\nFN:${c.name}\nORG:${c.company}\nTITLE:${c.jobTitle}\nTEL:${c.phone}${c.ext ? ',' + c.ext : ''}\nNOTE:統編:${c.taxId}\nEND:VCARD`;
    let a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([v], { type: 'text/vcard' })); a.download = `${c.name}.vcf`; a.click();
}

async function processImage(src) {
    $('#modal').innerHTML = `<div class="modalbg"><div class="modalbox"><h2>🤖 辨識中...</h2><img class="preview" src="${src}"><div id="status">載入引擎</div></div></div>`;
    if (!window.Tesseract) {
        let s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        await new Promise(res => { s.onload = res; document.head.appendChild(s); });
    }
    const w = await Tesseract.createWorker('eng+chi_tra');
    const r = await w.recognize(src); await w.terminate();
    showResult(src, r.data.text);
}

function closeModal() { if (stream) stream.getTracks().forEach(t => t.stop()); $('#modal').innerHTML = ''; }

// 初始化
document.querySelectorAll('nav button[data-page]').forEach(b => b.onclick = () => { page = b.dataset.page; render(); });
loadAll();
```
