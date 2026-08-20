```javascript
// AI 名片管家 Pro - v5.0 (app-5.js)
const DB_NAME = 'ai-card-db-v5', STORE = 'cards';
let cards = [], page = 'home', tesseractWorker = null;
let currentScan = { front: null, back: null, frontText: '', backText: '' };

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- 1. 資料庫操作 [1] ---
const dbOp = async (type, data) => {
    const db = await new Promise((res, rej) => {
        const req = indexedDB.open(DB_NAME, 1);
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

// --- 2. 介面渲染 (修正 v3.0 語法錯誤 [2, 3]) ---
function row(c) {
    return `<button class="card" data-id="${c.id}">
        <div class="avatar">${c.photo ? `<img src="${c.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : esc(c.name?.trim() || '?')}</div>
        <div class="cm">
            <div class="cn">${esc(c.name || '未命名')} ${c.favorite ? '★' : ''}</div>
            <div class="co">${esc(c.company || '未填寫公司')}</div>
            <div class="job">${esc(c.jobTitle || '')}</div>
        </div>
        <div class="arrow">›</div>
    </button>`;
}

function render() {
    if (page === 'home') home();
    else if (page === 'cards') cardsPage();
    else settings();
    document.querySelectorAll('nav button[data-page]').forEach(x => x.classList.toggle('active', x.dataset.page === page));
}

function home() {
    $('#main').innerHTML = `
        <div class="search">🔍 <input id="q" placeholder="搜尋姓名、公司..."></div>
        <button class="hero" id="scanBtn">
            <div class="cam">📷</div>
            <h2>拍攝名片</h2>
            <p>使用系統相機以獲得最佳辨識率</p>
        </button>
        <div class="stats">
            <div class="stat"><div class="num">${cards.length}</div><div class="muted">全部</div></div>
        </div>
        <div id="list">${cards.slice().reverse().slice(0, 5).map(row).join('')}</div>
        <input type="file" id="nativeCam" accept="image/*" capture="environment" style="display:none">
    `;
    $('#scanBtn').onclick = () => { currentScan = { front:null, back:null }; $('#nativeCam').click(); };
    $('#nativeCam').onchange = e => handleCapture(e, 'front');
    loadAll();
}

// --- 3. 影像處理與 OCR 優化 [4, 5] ---
async function handleCapture(e, side) {
    const file = e.target.files;
    if (!file) return;

    // 顯示辨識中狀態
    $('#modal').innerHTML = `<div class="modalbg"><div class="modalbox"><h2>🤖 正在辨識${side==='front'?'正面':'背面'}...</h2><p>影像優化中...</p></div></div>`;
    
    const img = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 預處理：提升對比度，輔助 OCR 辨識
    canvas.width = 1200; canvas.height = 750;
    ctx.filter = 'contrast(1.4) grayscale(0.2)';
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, 1200, 750);
    
    const processedSrc = canvas.toDataURL('image/jpeg', 0.85);
    
    if (!tesseractWorker) {
        if (!window.Tesseract) {
            let s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            await new Promise(res => { s.onload = res; document.head.appendChild(s); });
        }
        tesseractWorker = await Tesseract.createWorker('eng+chi_tra');
    }

    const { data: { text } } = await tesseractWorker.recognize(processedSrc);
    
    if (side === 'front') {
        currentScan.front = processedSrc;
        currentScan.frontText = text;
        if (confirm("名片正面辨識完成。是否拍攝背面以抓取英文資訊？")) {
            $('#nativeCam').onchange = ev => handleCapture(ev, 'back');
            $('#nativeCam').click();
        } else {
            showResult(currentScan.front, currentScan.frontText);
        }
    } else {
        currentScan.backText = text;
        showResult(currentScan.front, currentScan.frontText + "\n" + currentScan.backText);
    }
}

// --- 4. 解析邏輯 (強化英文與特殊欄位 [4]) ---
function parse(t) {
    let l = t.split(/\n+/).map(x => x.trim()).filter(Boolean), a = l.join(' ');
    return {
        id: Date.now().toString(),
        name: l.find(x => /^[\u4e00-\u9fff]{2,4}$/.test(x)) || l || '未知姓名',
        company: l.find(x => /(公司|科技|銀行|Co\.|Ltd|Inc)/i.test(x)) || '',
        jobTitle: l.find(x => /(經理|主任|專員|CEO|Manager|Director)/i.test(x)) || '',
        phone: (a.match(/(?:09\d{2}[- ]?\d{3}[- ]?\d{3}|0\d[- ]?\d{3,4}[- ]?\d{3,4})/) || ['']),
        email: (a.match(/[a-zA-Z0-0._%+-]+@[a-zA-Z0-0.-]+\.[a-zA-Z]{2,}/) || ['']),
        taxId: (a.match(/\b\d{8}\b/) || ['']),
        photo: currentScan.front,
        favorite: false
    };
}

function showResult(src, text, existingCard = null) {
    let p = existingCard || parse(text);
    $('#modal').innerHTML = `
        <div class="modalbg">
            <div class="modalbox">
                <div class="mh"><h2>確認名片資訊</h2><button class="close" onclick="closeModal()">✕</button></div>
                <div class="field"><label>姓名</label><input id="f_name" value="${esc(p.name)}"></div>
                <div class="field"><label>公司</label><input id="f_company" value="${esc(p.company)}"></div>
                <div class="field"><label>電話</label><input id="f_phone" value="${esc(p.phone)}"></div>
                <div class="field"><label>Email</label><input id="f_email" value="${esc(p.email)}"></div>
                <button class="primary" id="saveBtn">💾 儲存名片</button>
            </div>
        </div>`;
    
    $('#saveBtn').onclick = async () => {
        const updated = { ...p, 
            name: $('#f_name').value, company: $('#f_company').value, 
            phone: $('#f_phone').value, email: $('#f_email').value 
        };
        await dbOp('put', updated);
        closeModal();
        loadAll();
    };
}

function closeModal() { $('#modal').innerHTML = ''; }

// 綁定導覽按鈕
document.querySelectorAll('nav button[data-page]').forEach(b => b.onclick = () => { page = b.dataset.page; render(); });
loadAll();
```
