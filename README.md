# Sun AI運動教練系統

一個可直接部署成公開網址的前端跑步教練工具。

系統特色：
- 根據目標完賽時間、自身近況、可跑時段同 dry windows 生成每週訓練計劃
- 支援批量上傳 CSV 活動紀錄
- 自動分析跑步活動、目前能力、目標進度同 AI 教練建議
- 以月曆檢視過往活動，並可點擊查看單次活動分析
- 訓練計劃會根據傷患、睡眠、生活安排、不能跑步日子即時調整

## 專案結構

- [index.html](H:\我的雲端硬碟\Run\index.html)：主頁面與介面結構
- [styles.css](H:\我的雲端硬碟\Run\styles.css)：版面與視覺樣式
- [app.js](H:\我的雲端硬碟\Run\app.js)：資料處理、CSV 匯入、天氣分析與課表邏輯

## 本地使用

這是一個純前端靜態網站，直接打開 `index.html` 已可使用。

如果想用本地伺服器測試，可以用任何簡單 static server，例如：

```powershell
cd H:\我的雲端硬碟\Run
python -m http.server 8080
```

之後打開 `http://localhost:8080`

## 部署給其他人使用

目前最適合的分享方式是部署成公開網址。

### 方案 1：Netlify

1. 將整個資料夾上傳到 GitHub
2. 在 Netlify 新增一個 site
3. 選擇該 repo
4. Build command 留空
5. Publish directory 填 `/`
6. Deploy

本專案已包含 [netlify.toml](H:\我的雲端硬碟\Run\netlify.toml)，通常不需額外設定。

### 方案 2：Vercel

1. 將整個資料夾上傳到 GitHub
2. 在 Vercel Import Project
3. 選擇該 repo
4. Framework Preset 選 `Other`
5. Build command 留空
6. Output directory 留空
7. Deploy

本專案已包含 [vercel.json](H:\我的雲端硬碟\Run\vercel.json)。

### 方案 3：GitHub Pages

1. 將專案推上 GitHub repo
2. 到 repo `Settings > Pages`
3. Source 選 `Deploy from a branch`
4. Branch 選 `main` / `root`
5. 儲存後等待 GitHub Pages 發佈

本專案已包含 [.nojekyll](H:\我的雲端硬碟\Run\.nojekyll)。

## 目前限制

這個版本已可公開俾其他人用，但要注意：

- 使用者資料主要儲存在各自瀏覽器的 `localStorage`
- 每個人資料互不共享
- 換裝置或清除瀏覽器資料後，已匯入紀錄可能會消失
- 暫時未有登入系統與雲端同步

如果之後想正式俾多人長期使用，建議下一步加：
- 登入系統
- 雲端資料庫，例如 Supabase / Firebase
- 使用者帳戶資料同步

## CSV 格式

支援一般活動摘要 CSV，例如：

```csv
date,type,distance,duration,avg_hr,elevation,rpe,resting_hr,notes
2026-04-17,easy,8.2,46,152,38,5,52,legs felt good
2026-04-19,long,16.0,98,148,120,7,54,a bit tired near the end
```

常見可讀欄位包括：
- `date`
- `type`
- `distance`
- `distance_km`
- `duration`
- `duration_min`
- `avg_hr`
- `avgHr`
- `elevation`
- `elevation_m`
- `resting_hr`
- `restingHr`
- `notes`

活動類型建議：
- `easy`
- `tempo`
- `interval`
- `long`
- `recovery`
- `cross`
- `race`

## 下一步建議

如果你打算俾朋友或跑友直接使用，建議優先做：

1. 部署成公開網址
2. 測試 CSV 匯入流程
3. 再決定是否加登入與雲端同步
