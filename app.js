```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>AI 名片管家 Pro</title>
    <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
    <style>
        :root { --p: #2563eb; --bg: #f8fafc; --card: #ffffff; }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { font-family: -apple-system, sans-serif; background: var(--bg); margin: 0; padding-bottom: 80px; }
        
        /* UI 元件 */
        header { background: var(--card); padding: 15px; position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .search { background: #f1f5f9; padding: 10px; border-radius: 10px; display: flex; align-items: center; }
        .search input { background: none; border: none; width: 100%; margin-left: 10px; font-size: 16px; outline: none; }
        
        .hero { background: var(--p); color: white; margin: 15px; padding: 30px 20px; border-radius: 20px; text-align: center; border: none; width: calc(100% - 30px); }
        .hero h2 { margin: 10px 0 5px; }
        
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 15px; }
        .stat { background: var(--card); padding: 15px; border-radius: 12px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .num { font-size: 20px; font-weight: bold; color: var(--p); }
        
        #list { padding: 15px; }
        .card-item { background: var(--card); padding: 15px; border-radius: 12px; margin-bottom: 10px; display: flex; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: none; width: 100%; text-align: left; }
        .avatar { width: 45px; height: 45px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-right: 15px; flex-shrink: 0; overflow: hidden; }
        .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .card-info { flex: 1; }
        .cn { font-weight: bold; font-size: 16px; }
        .co { color: #64748b; font-size: 13px; }
        
        /* Modal & Form */
        .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; align-items: flex-end; }
        .modal-box { background: var(--card); width: 100%; max-height: 90vh; border-radius: 20px 20px 0 0; padding: 20px; overflow-y: auto; }
        .field { margin-bottom: 15px; }
        .field label { display: block; font-size: 12px; color: #64748b; margin-bottom: 5px; }
        .field input, .field select, .field textarea { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 16px; }
        
        nav { position: fixed; bottom: 0; width: 100%; background: var(--card); display: flex; border-top: 1px solid #e2e8f0; padding-bottom: env(safe-area-inset-bottom); }
        nav button { flex: 1; padding: 15px; border: none; background: none; color: #64748b; font-size: 12px; }
        nav button.active { color: var(--p); font-weight: bold; }
        
        .btn { padding: 12px; border-radius: 10px; border: none; font-weight: bold; width: 100%; margin-top: 10px; cursor: pointer; }
        .btn-p { background: var(--p); color: white; }
        .btn-s { background: #e2e8f0; color: #475569; }
        .preview { width: 100%; border-radius: 10px; margin-bottom: 15px; }
    </style>
</head>
<body>

<div id="app">
    <header>
        <div class="search">🔍 <input id="q" placeholder="搜尋姓名、公司..." oninput="handleSearch(this.value)"></div>
    </header>
    
    <main id="main"></main>

    <nav>
        <button onclick="setPage('home')" id="nav-home">🏠 首頁</button>
        <button onclick="setPage('cards')" id="nav-cards">📇 名片</button>
        <button onclick="setPage('settings')" id="nav-settings">⚙️ 設定</button>
    </nav>
</div>

<!-- 隱藏的檔案輸入框：直接觸發原生相機 -->
<input type="file" id="cam-input" accept="image/*" capture="environment" style="display:none" onchange="handleFile(this)">

<div id="modal-container"></div>

<script>
// --- 1. IndexedDB 核心邏輯 ---
const DB_NAME = 'CardAppDB', STORE_NAME = 'cards';
const openDB = () => new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 3);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
});

async function dbOp(type, data) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, type === 'read' ? 'readonly' : 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    return new Promise(res => {
        const req = type === 'get' ? store.get(data) : type === 'getAll' ? store.getAll() : type === 'put' ? store.put(data) : store.delete(data);
        req.onsuccess = e => res(e.target.result);
    });
}

// --- 2. 狀態管理 ---
let cards = [], currentPage = 'home';
const $ = s => document.querySelector(s);

async function init() {
    cards = await dbOp('getAll');
    render();
}

function setPage(p) { currentPage = p; render(); }

// --- 3. 渲染邏輯 ---
function render() {
    const main = $('#main');
    document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.id === `nav-${currentPage}`));
    
    if (currentPage === 'home') {
        main.innerHTML = `
            <button class="hero" onclick="$('#cam-input').click()">
                <div style="font-size:40px">📷</div>
                <h2>拍攝名片</h2>
                <p>啟動 iPhone 原生相機辨識</p>
            </button>
            <div class="grid">
                <div class="stat"><div class="num">${cards.length}</div><div style="font-size:12px;color:#64748b">總名片</div></div>
                <div class="stat"><div class="num">${cards.filter(c=>c.fav).length}</div><div style="font-size:12px;color:#64748b">最愛</div></div>
            </div>
            <div style="padding:15px"><h3>最近新增</h3></div>
            <div id="list">${renderList(cards.slice().reverse().slice(0,5))}</div>
        `;
    } else if (currentPage === 'cards') {
        main.innerHTML = `<div style="padding:15px"><h3>我的所有名片 (${cards.length})</h3></div><div id="list">${renderList(cards)}</div>`;
    } else {
        main.innerHTML = `<div style="padding:20px"><h3>設定</h3><button class="btn btn-s" onclick="exportJSON()">匯出 JSON 備份</button></div>`;
    }
}

function renderList(list) {
    return list.map(c => `
        <button class="card-item" onclick="showDetail('${c.id}')">
            <div class="avatar">${c.img ? `<img src="${c.img}">` : c.name}</div>
            <div class="card-info">
                <div class="cn">${c.name} ${c.fav ? '⭐' : ''}</div>
                <div class="co">${c.company || '未註明公司'}</div>
            </div>
            <div style="color:#cbd5e1">›</div>
        </button>
    `).join('') || '<p style="text-align:center;color:#94a3b8">尚無資料</p>';
}

// --- 4. 影像處理與 OCR ---
async function handleFile(input) {
    if (!input.files?.) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const src = e.target.result;
        showLoading(src);
        const worker = await Tesseract.createWorker('eng+chi_tra');
        const { data: { text } } = await worker.recognize(src);
        await worker.terminate();
        const parsed = parseText(text);
        showEditModal({ ...parsed, img: src, id: Date.now().toString(), fav: false });
    };
    reader.readAsDataURL(input.files);
}

function parseText(t) {
    const lines = t.split('\n').map(s => s.trim()).filter(Boolean);
    const full = lines.join(' ');
    return {
        name: lines.find(l => /^[\u4e00-\u9fff]{2,4}$/.test(l)) || '未知名',
        company: lines.find(l => /(公司|科技|銀行|Ltd|Inc)/i.test(l)) || '',
        phone: (full.match(/(09\d{8}|0\d{1,2}-\d{7,8})/) || ['']),
        email: (full.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [''])
    };
}

// --- 5. 互動功能 ---
function showDetail(id) {
    const c = cards.find(x => x.id === id);
    const box = `
        <div class="modal"><div class="modal-box">
            <img src="${c.img}" class="preview">
            <h2>${c.name}</h2>
            <p>${c.company} | ${c.phone}</p>
            <div class="grid" style="padding:0">
                <button class="btn btn-s" onclick="location.href='tel:${c.phone}'">📞 撥打</button>
                <button class="btn btn-s" onclick="exportVCard('${c.id}')">📇 存入通訊錄</button>
            </div>
            <button class="btn btn-p" onclick="showEditModal('${c.id}')">✏️ 編輯資訊</button>
            <button class="btn btn-s" style="color:red" onclick="deleteCard('${c.id}')">🗑️ 刪除名片</button>
            <button class="btn btn-s" onclick="$('#modal-container').innerHTML=''">關閉</button>
        </div></div>`;
    $('#modal-container').innerHTML = box;
}

function showEditModal(cardOrId) {
    const c = typeof cardOrId === 'string' ? cards.find(x => x.id === cardOrId) : cardOrId;
    $('#modal-container').innerHTML = `
        <div class="modal"><div class="modal-box">
            <h3>編輯名片資訊</h3>
            <div class="field"><label>姓名</label><input id="e-name" value="${c.name}"></div>
            <div class="field"><label>公司</label><input id="e-co" value="${c.company}"></div>
            <div class="field"><label>電話</label><input id="e-tel" value="${c.phone}"></div>
            <div class="field"><label>Email</label><input id="e-mail" value="${c.email}"></div>
            <button class="btn btn-p" onclick="saveCard('${c.id}', '${c.img.replace(/'/g,"\\'")}')">💾 儲存</button>
            <button class="btn btn-s" onclick="$('#modal-container').innerHTML=''">取消</button>
        </div></div>`;
}

async function saveCard(id, img) {
    const newCard = {
        id, img,
        name: $('#e-name').value,
        company: $('#e-co').value,
        phone: $('#e-tel').value,
        email: $('#e-mail').value,
        fav: cards.find(x=>x.id===id)?.fav || false
    };
    await dbOp('put', newCard);
    cards = await dbOp('getAll');
    $('#modal-container').innerHTML = '';
    render();
}

async function deleteCard(id) {
    if(!confirm('確定刪除？')) return;
    await dbOp('delete', id);
    cards = await dbOp('getAll');
    $('#modal-container').innerHTML = '';
    render();
}

function exportVCard(id) {
    const c = cards.find(x => x.id === id);
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${c.name}\nORG:${c.company}\nTEL:${c.phone}\nEMAIL:${c.email}\nEND:VCARD`;
    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${c.name}.vcf`; a.click();
}

function showLoading(src) {
    $('#modal-container').innerHTML = `<div class="modal"><div class="modal-box" style="text-align:center">
        <img src="${src}" class="preview" style="opacity:0.5">
        <p>AI 辨識中，請稍候...</p>
    </div></div>`;
}

init();
</script>
</body>
</html>
```
