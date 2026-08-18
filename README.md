# AI 名片管家 iPhone PWA V0.2

## V0.2 核心功能
1. iPhone 相機拍攝名片
2. Safari 相簿選取照片（相機權限失敗時）
3. Tesseract.js OCR
4. 中英文文字辨識
5. 自動解析：
   - 姓名
   - 公司
   - 職稱
   - 手機
   - 電話
   - Email
   - 網站
   - 地址
   - 分類
6. 使用者確認後存入本機資料庫
7. 名片搜尋、最愛、分類
8. 一鍵電話 / Email / Apple Maps
9. JSON 備份/還原
10. PWA 加入 iPhone 主畫面

## 重要說明
V0.2 的「AI」採用「OCR + 本機規則式欄位解析」，不需要把名片資料送到第三方 AI API，因此比較適合先做私人測試。

Tesseract.js 從 jsDelivr 載入，第一次 OCR 需要下載語言模型，速度會依 iPhone 與網路而不同。

PWA 必須透過 HTTPS 網站提供，不能用 file:// 直接當正式 PWA。

## V0.3 建議
若要更接近商業級「全能名片王」：
- AI Vision/LLM 結構化辨識
- 自動裁切名片四角與透視校正
- 一次掃多張
- 重複名片比對
- 名片照片壓縮
- iPhone Contacts
- iCloud 同步
- AI 自動摘要與提醒
- 公司/人物關聯
- OCR 信心度與錯誤提示

不要把 OpenAI API Key 直接放進前端 PWA；正式版應透過自己的後端代理 API。
