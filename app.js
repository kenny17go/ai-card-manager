```javascript
// AI 名片管家 Pro - v4.0 (app-4.js)
const DB_NAME = 'ai-card-db-v4', STORE = 'cards';
let cards = [], page = 'home', stream = null, tesseractWorker = null;
let currentScanData = { front: '', back: '', frontText: '', backText: '' };

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initial = c => (c.name || '?').trim().charAt(0) || '?';

// --- 1. 資料庫操作 ---
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

// --- 2. 介面渲染 ---
function row(c) {
    return `<button class="card" data-id="${c.id}">
        <div class="avatar">${c.photo ? `<img src="${c.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : esc(initial(c))}</div>
        <div class="cm">
            <div class="cn">${esc(c.name || '未命名')} ${c.favorite ? '★' : ''}</div>
            <div class="co">${esc(c.company || '未填寫公司')}</div>
        </div>
        <div class="arrow">›</div>
    </button>`;
}

function render() {
    const main = $('#main');
    if (page === 'home') home();
    else if (page === 'cards') cardsPage();
    else settings();
    document.querySelectorAll('nav button[data-page]').forEach(x => x.classList.toggle('active', x.dataset.page === page));
}

function home() {
    $('#main').innerHTML = `
        <div class="search">🔍 <input id="q" placeholder="搜尋姓名、公司..."></div>
        <button class="hero" id="scan">
            <div class="cam">📷</div>
            <h2>拍攝名片</h2>
            <p>支援正反面辨識與影像增強</p>
        </button>
        <div class="stats">
            <div class="stat"><div class="num">${cards.length}</div><div class="muted">全部</div></div>
        </div>
        <div id="list">${cards.slice().reverse().slice(0, 5).map(row).join('')}</div>
    `;
    $('#scan').onclick = () => openScanner('front');
    loadAll();
}

// --- 3. 強化影像擷取與雙面邏輯 [4, 8] ---
async function openScanner(side = 'front') {
    $('#modal').innerHTML = `
        <div class="modalbg">
            <div class="modalbox">
                <div class="mh">
                    <h2>📷 拍攝名片 (${side === 'front' ? '正面' : '背面'})</h2>
                    <button class="close" id="x">✕</button>
                </div>
                <div id="cameraArea">
                    <div class="camera">
                        <video id="video" autoplay muted playsinline></video>
                        <div class="guide"></div>
                    </div>
                    <button class="shutter" id="shutter">●</button>
                </div>
                <p class="notice">請將名片填滿框線，系統將自動校正辨識度。</p>
            </div>
        </div>`;
    $('#x').onclick = closeModal;
    startCamera(side);
}

async function startCamera(side) {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        $('#video').srcObject = stream;
        $('#shutter').onclick = () => capture(side);
    } catch (e) { alert("無法啟動相機: " + e); }
}

function capture(side) {
    const v = $('#video'), c = document.createElement('canvas'), ctx = c.getContext('2d');
    const vW = v.videoWidth, vH = v.videoHeight;
    
    // 計算名片比例裁切 (1.6:1) [4]
    const cropW = vW * 0.85, cropH = cropW / 1.6;
    const startX = (vW - cropW) / 2, startY = (vH - cropH) / 2;
    c.width = 1000; c.height = 625; // 標準化儲存大小

    // 影像預處理：提升對比度與銳利度以利 OCR [4]
    ctx.filter = 'contrast(1.4) brightness(1.1) grayscale(0.2)';
    ctx.drawImage(v, startX, startY, cropW, cropH, 0, 0, 1000, 625);
    
    const src = c.toDataURL('image/jpeg', 0.85);
    closeModal();

    if (side === 'front') {
        currentScanData.front = src;
        if (confirm("是否要拍攝背面以獲取英文資訊？")) {
            openScanner('back');
        } else {
            processDualImages();
        }
    } else {
        currentScanData.back = src;
        processDualImages();
    }
}

// --- 4. OCR 引擎優化 (Singleton) [5] ---
async function initOCR() {
    if (!window.Tesseract) {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        await new Promise(res => { s.onload = res; document.head.appendChild(s); });
    }
    if (!tesseractWorker) {
        tesseractWorker = await Tesseract.createWorker('eng+chi_tra');
    }
    return tesseractWorker;
}

async function processDualImages() {
    $('#modal').innerHTML = `<div class="modalbg"><div class="modalbox"><h2>🤖 正在辨識雙面資訊...</h2><div id="status">啟動 OCR 引擎...</div></div></div>`;
    const worker = await initOCR();
    
    // 辨識正面
    const res1 = await worker.recognize(currentScanData.front);
    currentScanData.frontText = res1.data.text;
    
    // 辨識背面 (如有)
    if (currentScanData.back) {
        const res2 = await worker.recognize(currentScanData.back);
        currentScanData.backText = res2.data.text;
    }

    const mergedText = currentScanData.frontText + "\n" + currentScanData.backText;
    showResult(currentScanData.front, mergedText);
}

// --- 5. 強化後的解析邏輯 [4] ---
function parse(t) {
    const lines = t.split('\n').map(x => x.trim()).filter(l => l.length > 1);
    const fullText = lines.join(' ');
    
    return {
        id: Date.now().toString(),
        name: lines.find(l => /^[\u4e00-\u9fff]{2,4}$/.test(l)) || lines || '未知姓名',
        company: lines.find(l => /(公司|科技|銀行|Ltd|Inc|Co\.)/i.test(l)) || '',
        phone: (fullText.match(/(?:09\d{2}[- ]?\d{3}[- ]?\d{3}|0\d[- ]?\d{3,4}[- ]?\d{3,4})/) || ['']),
        email: (fullText.match(/[a-zA-Z0-0._%+-]+@[a-zA-Z0-0.-]+\.[a-zA-Z]{2,}/) || ['']),
        taxId: (fullText.match(/\b\d{8}\b/) || ['']),
        jobTitle: lines.find(l => /(經理|主任|專員|CEO|Manager|Director)/i.test(l)) || '',
        photo: currentScanData.front,
        favorite: false,
        note: `辨識原始碼：\n${fullText.substring(0, 100)}...`
    };
}

function showResult(src, text, existingCard = null) {
    const p = existingCard || parse(text);
    $('#modal').innerHTML = `
        <div class="modalbg">
            <div class="modalbox">
                <div class="mh"><h2>確認資訊</h2><button class="close" onclick="closeModal()">✕</button></div>
                <div class="field"><label>姓名</label><input id="f_name" value="${esc(p.name)}"></div>
                <div class="field"><label>公司</label><input id="f_company" value="${esc(p.company)}"></div>
                <div class="field"><label>電話</label><input id="f_phone" value="${esc(p.phone)}"></div>
                <div class="field"><label>Email</label><input id="f_email" value="${esc(p.email)}"></div>
                <button class="primary" id="save">💾 儲存名片</button>
            </div>
        </div>`;
    
    $('#save').onclick = async () => {
        const updated = { ...p, 
            name: $('#f_name').value, 
            company: $('#f_company').value, 
            phone: $('#f_phone').value,
            email: $('#f_email').value
        };
        await dbOp('put', updated);
        closeModal();
        loadAll();
    };
}

function closeModal() { 
    if (stream) stream.getTracks().forEach(t => t.stop()); 
    stream = null;
    $('#modal').innerHTML = ''; 
}

// 啟動
loadAll();
```
