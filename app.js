const KEY="ai-card-manager-v02-data", $=s=>document.querySelector(s);
const screen=$("#screen"), modalRoot=$("#modalRoot");
let cards=JSON.parse(localStorage.getItem(KEY)||"null")||[];
let activeTab="home",stream=null;

function save(){localStorage.setItem(KEY,JSON.stringify(cards))}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function initial(c){return (c.name||"?").trim().charAt(0)||"?"}
function render(){activeTab==="home"?home():activeTab==="cards"?cardsPage():activeTab==="categories"?categories():settings();document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===activeTab))}
function searchBox(){return `<div class="search">🔍<input id="search" placeholder="搜尋姓名、公司、電話、Email…"></div>`}
function row(c){return `<button class="card-row" data-id="${c.id}"><div class="avatar">${esc(initial(c))}</div><div class="card-main"><div class="card-name">${esc(c.name||"未命名")} ${c.favorite?"<span class=star>★</span>":""}</div><div class=company>${esc(c.company||"未填寫公司")}</div><div class=job>${esc(c.jobTitle||"")}</div></div><div class=arrow>›</div></button>`}
function bind(){document.querySelectorAll("[data-id]").forEach(x=>x.onclick=()=>detail(x.dataset.id))}
function home(){
screen.innerHTML=`${searchBox()}<button class=hero id=scan><div class=camera>📷</div><h2>拍攝名片，AI 自動辨識</h2><p>V0.2：拍照 → OCR → 自動填入資料</p></button><div class=stats><div class=stat><div class=num>${cards.length}</div><div class=lbl>全部名片</div></div><div class=stat><div class=num>${cards.filter(c=>c.favorite).length}</div><div class=lbl>我的最愛</div></div></div><div class=section-title><h2>最近新增</h2></div><div id=list>${cards.slice().reverse().slice(0,8).map(row).join("")||empty()}</div>`;
$("#scan").onclick=()=>openScanner();$("#search").oninput=e=>filter(e.target.value);bind()}
function filter(q){q=q.toLowerCase();let f=cards.filter(c=>Object.values(c).join(" ").toLowerCase().includes(q));$("#list").innerHTML=f.map(row).join("")||empty();bind()}
function empty(){return `<div class=empty><div style="font-size:42px">📇</div><p>還沒有名片</p><button class=secondary onclick="openScanner()">掃描第一張名片</button></div>`}
function cardsPage(){screen.innerHTML=`${searchBox()}<div class=section-title><h2>我的名片</h2><span class=muted>${cards.length} 張</span></div><div id=list>${cards.map(row).join("")||empty()}</div>`;$("#search").oninput=e=>filter(e.target.value);bind()}
function categories(){let names=["我的最愛","客戶","供應商","科技業","金融","飯店","旅遊","展覽","未分類"];screen.innerHTML=`<div class=section-title><h2>分類</h2></div>`+names.map(n=>`<button class=cat-row data-cat="${n}"><span class=cat-icon>🏷️</span><b>${n}</b><span class=count>${n==="我的最愛"?cards.filter(c=>c.favorite).length:cards.filter(c=>c.category===n).length}</span>›</button>`).join("");document.querySelectorAll("[data-cat]").forEach(x=>x.onclick=()=>{let n=x.dataset.cat,f=n==="我的最愛"?cards.filter(c=>c.favorite):cards.filter(c=>c.category===n);screen.innerHTML=`<div class=section-title><h2>${n}</h2><button class=secondary onclick=render()>返回</button></div>${f.map(row).join("")||empty()}`;bind()})}
function settings(){screen.innerHTML=`<div class=section-title><h2>設定</h2></div><div class=panel><h3>🤖 AI 辨識</h3><div class=info-row><span>瀏覽器 OCR</span><span class=muted>V0.2 啟用</span></div><div class=info-row><span>自動欄位解析</span><span class=muted>V0.2 啟用</span></div><div class=info-row><span>雲端 LLM</span><span class=muted>未設定 API</span></div></div><div class=panel><h3>💾 資料</h3><div class=info-row><button onclick=exportData()>匯出 JSON 備份</button></div><div class=info-row><button onclick=importData()>匯入 JSON 備份</button></div></div><div class=panel><h3>📌 V0.2</h3><div class=info-row><span>拍照</span><b>✓</b></div><div class=info-row><span>OCR 文字辨識</span><b>✓</b></div><div class=info-row><span>姓名/公司/電話/Email/地址解析</span><b>✓</b></div><div class=info-row><span>AI 分類</span><span class=muted>規則式自動分類</span></div></div>`}
function close(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}modalRoot.innerHTML=""}
function openScanner(){
modalRoot.innerHTML=`<div class=modal-backdrop><div class=modal><div class=modal-head><h2>📷 AI 掃描名片</h2><button class=close id=close>✕</button></div><div class=notice>將名片放入框線內。V0.2 會先用 OCR 讀取文字，再自動整理欄位。</div><div id=camera></div><div id=result></div></div></div>`;
$("#close").onclick=close;startCamera()}
async function startCamera(){
const area=$("#camera");area.innerHTML=`<div class=camera-box><video id=video autoplay playsinline></video><div class=camera-guide></div></div><div class=camera-controls><button class=shutter id=shutter>●</button></div><canvas id=canvas hidden></canvas>`;
try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});$("#video").srcObject=stream;$("#shutter").onclick=capture}catch(e){area.innerHTML=`<div class=notice>無法開啟相機。請使用 HTTPS，並允許 Safari 相機權限。你也可以改用相簿照片。</div><input id=file type=file accept="image/*" capture="environment">`;$("#file").onchange=e=>{let f=e.target.files[0];if(f)processImage(URL.createObjectURL(f))}}
function capture(){let v=$("#video"),c=$("#canvas");c.width=v.videoWidth;c.height=v.videoHeight;c.getContext("2d").drawImage(v,0,0);let data=c.toDataURL("image/jpeg",.88);if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}processImage(data)}
async function processImage(src){
$("#camera").innerHTML=`<img class=photo-preview src="${src}"><div class=notice id=status>正在進行 OCR…</div><div class=progress><div id=bar></div></div>`;
try{
 const worker=await Tesseract.createWorker("eng+chi_tra",1,{logger:m=>{if(m.status){$("#status").textContent=`${m.status} ${Math.round((m.progress||0)*100)}%`;$("#bar").style.width=((m.progress||0)*100)+"%"}}});
 const out=await worker.recognize(src);await worker.terminate();
 const text=out.data.text||"";
 const parsed=parseCard(text);
 showResult(src,text,parsed);
}catch(e){$("#status").textContent="OCR 失敗，請改用光線更好、字體清楚的名片照片。";showResult(src,"",{})}
}
function parseCard(text){
const lines=text.split(/\n+/).map(x=>x.replace(/[|]/g,"").trim()).filter(Boolean);
const all=lines.join(" ");
const email=(all.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)||[])[0]||"";
const phones=(all.match(/(?:\+?886[-\s]?)?(?:0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{3,4}|09\d{2}[-\s]?\d{3}[-\s]?\d{3})/g)||[]);
const website=(all.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?/i)||[])[0]||"";
let address=lines.find(x=>/(台北|新北|桃園|新竹|台中|彰化|嘉義|台南|高雄|基隆|宜蘭|花蓮|臺北|臺中|臺南|高雄).*(市|縣|區|路|街|號)/.test(x))||"";
let mobile=phones.find(x=>/09\d{2}/.test(x))||"", phone=phones.find(x=>x!==mobile)||"";
let name=lines.find(x=>/^[\u4e00-\u9fff]{2,4}$/.test(x))||"";
if(!name)name=lines.find(x=>/^[A-Za-z][A-Za-z .'-]{2,30}$/.test(x)&&!x.includes("@"))||"";
let company=lines.find(x=>/(有限公司|股份有限公司|公司|科技|電子|銀行|集團|Co\.|Ltd|Inc|Corporation|Technology)/i.test(x))||"";
let job=lines.find(x=>/(經理|副理|主任|總監|董事|專員|工程師|顧問|業務|Sales|Manager|Director|Engineer|Consultant)/i.test(x))||"";
let category=/(科技|電子|軟體|Technology|Tech)/i.test(company)? "科技業":/(銀行|金融|保險|投資|Bank|Finance)/i.test(company)?"金融":/(旅|Tour|Travel|Hotel|飯店)/i.test(all)?"旅遊":"未分類";
return {name,company,jobTitle:job,mobile,phone,email,website,address,category,note:"",favorite:false}
}
function showResult(photo,text,p){
modalRoot.innerHTML=`<div class=modal-backdrop><div class=modal><div class=modal-head><h2>🤖 AI 辨識結果</h2><button class=close id=close>✕</button></div><img class=photo-preview src="${photo}"><div class=notice>請快速確認辨識結果。OCR 可能會因字型、光線或中英文混排而產生誤判。</div><div class=form-grid>${field("姓名","name",p.name,true)}${field("公司","company",p.company)}${field("職稱","jobTitle",p.jobTitle)}${field("手機","mobile",p.mobile,"","tel")}${field("電話","phone",p.phone,"","tel")}${field("Email","email",p.email,"","email")}${field("網站","website",p.website)}${field("地址","address",p.address)}${field("分類","category",p.category)}${field("備註","note",p.note,false,"","textarea")}</div><details class=panel><summary>查看 OCR 原文</summary><pre style="white-space:pre-wrap">${esc(text||"（沒有辨識到文字）")}</pre></details><button class=primary id=saveScan>✓ 確認並儲存</button><button class=secondary style="width:100%;margin-top:8px" id=retry>重新拍攝</button></div></div>`;
$("#close").onclick=close;$("#retry").onclick=openScanner;$("#saveScan").onclick=()=>saveParsed(photo)
}
function field(label,key,value,required=false,type="",kind=""){if(kind==="textarea")return `<div class="field full"><label>${label}</label><textarea id=f_${key}>${esc(value||"")}</textarea></div>`;return `<div class="field ${["name","company","address"].includes(key)?"full":""}"><label>${label}${required?" *":""}</label><input id=f_${key} type="${type||"text"}" value="${esc(value||"")}"></div>`}
function val(k){return $("#f_"+k)?.value.trim()||""}
function saveParsed(photo){let name=val("name");if(!name){alert("請補上姓名");return}cards.push({id:crypto.randomUUID(),name,company:val("company"),jobTitle:val("jobTitle"),mobile:val("mobile"),phone:val("phone"),email:val("email"),website:val("website"),address:val("address"),category:val("category")||"未分類",note:val("note"),favorite:false,photo,createdAt:new Date().toISOString()});save();close();activeTab="cards";render()}
function detail(id){let c=cards.find(x=>x.id===id);if(!c)return;modalRoot.innerHTML=`<div class=modal-backdrop><div class=modal><div class=modal-head><h2>名片</h2><button class=close id=close>✕</button></div><div class=detail-top>${c.photo?`<img class=photo-preview src="${c.photo}">`:`<div class=big-avatar>${esc(initial(c))}</div>`}<div class=detail-name>${esc(c.name)} ${c.favorite?"<span class=star>★</span>":""}</div><div class=detail-company>${esc(c.company)}</div><div class=muted>${esc(c.jobTitle)}</div><div class=actions><button class=action onclick="dial('${esc(c.mobile||c.phone)}')">📞<span class=ico>打電話</span></button><button class=action onclick="email('${esc(c.email)}')">✉️<span class=ico>Email</span></button><button class=action onclick="map('${esc(c.address)}')">🗺️<span class=ico>地圖</span></button></div></div><div class=panel><h3>聯絡方式</h3>${info("📱","手機",c.mobile,"call")}${info("☎️","電話",c.phone,"call")}${info("✉️","Email",c.email,"mail")}${info("🌐","網站",c.website,"web")}</div><div class=panel><h3>地址</h3>${esc(c.address||"未填寫")}</div><button class=primary id=fav>${c.favorite?"☆ 取消最愛":"★ 加入最愛"}</button><button class=primary style="background:#fee2e2;color:#b91c1c" id=del>🗑️ 刪除</button></div></div>`;$("#close").onclick=close;$("#fav").onclick=()=>{c.favorite=!c.favorite;save();close();render()};$("#del").onclick=()=>{if(confirm("確定刪除？")){cards=cards.filter(x=>x.id!==id);save();close();render()}}}
function info(i,l,v,t){if(!v)return"";return `<div class=info-row><span>${i}</span><span class=value><small class=muted>${l}</small><br>${esc(v)}</span><button onclick="${t==='call'?`dial('${esc(v)}')`:t==='mail'?`email('${esc(v)}')`:t==='web'?`location.href='${v.startsWith("http")?v:"https://"+v}'`:""}">開啟</button></div>`}
function dial(v){if(v)location.href="tel:"+v;else alert("沒有電話")}
function email(v){if(v)location.href="mailto:"+v;else alert("沒有 Email")}
function map(v){if(v)location.href="https://maps.apple.com/?address="+encodeURIComponent(v||"")}
function exportData(){let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(cards,null,2)],{type:"application/json"}));a.download="ai-card-manager-v02-backup.json";a.click()}
function importData(){let i=document.createElement("input");i.type="file";i.accept=".json";i.onchange=()=>{let r=new FileReader;r.onload=()=>{try{cards=JSON.parse(r.result);save();render();alert("匯入完成")}catch{alert("檔案錯誤")}};r.readAsText(i.files[0])};i.click()}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;render()});
$("#addBtn").onclick=openScanner;$("#settingsBtn").onclick=()=>{activeTab="settings";render()};
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
render();
