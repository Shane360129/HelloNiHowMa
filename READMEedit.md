# La Paisley ・ 霧眉美業工作室預約網站

React (Vite) + Express + MongoDB + LINE 通知整合。包含公開前台、線上預約表單、管理後台與雲端部署設定。

## 專案結構

- `client/` — React 前台與管理後台（Vite）
- `server/` — Express API、Mongoose models、LINE 通知整合

## 功能

### 前台
- 首頁 Hero / About / 服務項目 / 精選作品 / CTA
- 服務項目頁（價格、時長）
- 作品集（含分類篩選）
- 線上預約表單（姓名、電話、LINE ID、項目、日期時間、備註）

### 管理後台 `/admin`
- 預設帳密：`admin` / `admin123`（第一次登入後請至「系統設定」修改）
- 預約管理：查看、更新狀態（待確認 / 已確認 / 已完成 / 已取消）、詳情、刪除
- 服務項目 CRUD、作品 CRUD
- 個人資訊（品牌介紹、頭貼、Hero 圖、聯絡方式、社群）
- 系統設定：營業時間、預約開關、LINE 金鑰、測試通知、變更密碼

### LINE 通知
新預約建立時會自動推播給店家，支援兩種方式：

1. **LINE Messaging API（推薦）**
   - `LINE_CHANNEL_ACCESS_TOKEN`：Messaging API channel 的 access token
   - `LINE_TARGET_ID`：要接收通知的 userId / groupId
2. **LINE Notify（舊制備援）**
   - `LINE_NOTIFY_TOKEN`：個人/群組產生的 Notify token

這些金鑰可透過後台「系統設定」頁設定，或以環境變數方式覆寫。

## 本地開發

```bash
# 安裝依賴
npm run install:all

# 啟動 MongoDB（本機或 Atlas），並設定環境變數
export MONGODB_URI="mongodb://localhost:27017/la-paisley"

# 匯入預設資料（服務項目、作品、個資）
npm run seed

# 啟動後端 (port 4000)
npm run dev:server

# 啟動前端 (port 5173)
npm run dev:client
```

## 部署（Render）

- 本專案已附 `render.yaml`。於 Render 新增 Web Service 並連結此 repo 即可。
- 必要環境變數：
  - `MONGODB_URI`（MongoDB Atlas 連線字串）
  - `JWT_SECRET`（由 Render 自動產生）
  - `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_TARGET_ID`（或 `LINE_NOTIFY_TOKEN`）

亦可部署到 Railway / Fly.io / Vercel（前端）+ Render（後端）等平台。

## 參考

- 品牌靈感：IG [@la_paisley_2025](https://instagram.com/la_paisley_2025)

AUTHOR: Shane
