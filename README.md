# AI 名片管家 V0.2.1

這是針對 iPhone Safari 相機「按鈕無反應／不能拍照」問題重新整理的 PWA 測試版。

## 主要修正
- App 開啟時不再先載入 OCR，避免 CDN 失敗造成整個 App 按鈕失效。
- 相機只在使用者按「＋」或「拍攝名片」後才啟動。
- 使用 iPhone Safari `getUserMedia()` + `playsinline` + 後鏡頭。
- 相機失敗時仍提供「從照片選取／拍照」fallback。
- 拍照後才載入 Tesseract.js OCR。
- 名片可搜尋、分類、加入最愛。
- 名片可直接打電話、Email、Apple 地圖。
- 支援 JSON 匯出／匯入。

## GitHub Pages 更新
解壓縮後，把全部檔案放到 GitHub repository 根目錄並覆蓋舊版。
Settings → Pages → Deploy from a branch → main → /(root)。
完成後用 iPhone Safari 開啟 HTTPS 網址，再加入主畫面。
