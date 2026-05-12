# La Paisley

霧眉美業工作室預約網站 + 完整 LINE 生態整合（Login + LIFF + Messaging API + 自動提醒 + 後台管理）。

---

## 🌟 功能

### 客戶端
- 🟢 LINE 一鍵登入（OAuth + LIFF 雙模式，在 LINE App 內自動登入）
- 📅 線上預約（含可預約時段日曆 + 同電話歷史聚合）
- 📋 我的預約管理（查看 / 取消）
- 🔔 預約提醒 LINE 推播（可由客戶自行關閉）

### 店家後台
- 📊 Dashboard 即時統計（今日 / 本週 / 本月 / 系統健康 / 推播配額）
- 📆 完整預約管理 + 後台代客建立預約（電話 / 私訊 / 走入客戶）
- 👥 LINE 客戶管理（標籤 / 黑名單 / 推訊息 / 歷史聚合）
- 💬 LINE 訊息模板編輯（live preview + 測試發送 + 變數插入）
- 📢 主動推播（單發 / 標籤群發 / 全體追蹤者 + 配額即時顯示）
- 📱 Rich Menu 切換管理
- 🔒 完整稽核日誌（含 LINE 內一鍵確認操作）
- ⚙ 預約規則設定（緩衝、最早/最晚預約、取消時限、強制 LINE 登入）

### LINE 互動
- 📤 自動推播（預約成立 / 確認 / 取消 / 完成 / 前一天提醒）
- 🎴 店家 Flex Message + 一鍵確認/取消按鈕
- 🤖 機器人關鍵字回覆（預約 / 查預約 / 營業時間 / 聯絡 / 菜單）
- 🛡 Webhook HMAC-SHA256 簽章驗證 + 事件去重

---

## 🏗 技術架構

| 層級 | 技術 |
|------|------|
| 邊緣層 | Cloudflare（DNS / CDN / WAF / SSL） |
| 應用層 | Render Web Service（Node 22） |
| 資料層 | Supabase PostgreSQL（JSONB 大量使用） |
| 排程 | Render Cron Job（每整點，依設定值決定是否實際發送） |
| 前端 | React 19 + Vite 8 + React Router 7 |
| 後端 | Express 5 + Sequelize 6 |
| LINE | Messaging API + LINE Login + LIFF SDK 2.x |
| 認證 | bcryptjs + JWT（admin / customer 雙 audience） |

---

## 🚀 快速開始

### 本地開發

```bash
# 安裝依賴（client + server）
npm run install:all

# 設定最小環境變數
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/la_paisley"
export JWT_SECRET="dev-secret-please-change"

# 匯入預設資料（服務項目、作品、個人資訊）
npm run seed

# 啟動後端 (port 4000)
npm run dev:server

# 另一終端啟動前端 (port 5173)
npm run dev:client
```

### 部署到雲端

完整步驟請見 **[docs/DEPLOY.md](docs/DEPLOY.md)**。

簡要流程：
1. 在 LINE Developers Console 建立 Messaging API + LINE Login + LIFF App
2. 建立 Supabase 專案，取得 PostgreSQL 連線字串
3. 在 Render 連結此 repo + Blueprint 部署
4. 綁定自有網域 + Cloudflare DNS / SSL
5. 回 LINE Console 把 webhook / callback URL 改為正式網域
6. 首次登入後台修改預設密碼、填入 LINE 金鑰

---

## 🔐 預設管理員

```
帳號: admin
密碼: admin123
```

⚠️ **第一次登入後請立即至「系統設定 → 變更管理員密碼」修改。**

---

## 📁 專案結構

```
HelloNiHowMa/
├── client/                       React 前台 + 管理後台
│   └── src/
│       ├── pages/                公開頁 (Home/Services/Works/Booking/MyBookings)
│       ├── pages/admin/          後台 12 個管理頁
│       ├── components/           共用元件
│       ├── context/              AuthContext + CustomerAuthContext + api.js
│       └── lib/liff.js           LIFF SDK 封裝
├── server/                       Express API
│   ├── models/                   11 個 Sequelize 模型
│   ├── jobs/sendReminders.js     Cron 作業（預約提醒）
│   ├── index.js                  主要 API 路由
│   ├── line.js                   LINE Messaging push helpers
│   ├── lineAuth.js               LINE Login OAuth helpers
│   ├── lineWebhook.js            Webhook 簽章 + 事件處理
│   ├── messageTemplates.js       訊息模板 render + 預設 seed
│   ├── auditLog.js               稽核日誌 helper
│   ├── availability.js           可預約時段計算
│   └── seed.js                   初始資料匯入
├── docs/
│   ├── DEPLOY.md                 完整部署指南
│   └── cloud-line-integration.md 系統規格書（架構 / API / Schema / 決策）
├── package.json                  monorepo 啟動腳本
└── render.yaml                   Render Blueprint
```

---

## 📚 文件

- **[docs/DEPLOY.md](docs/DEPLOY.md)** — 從零到上線的完整部署指南
- **[docs/cloud-line-integration.md](docs/cloud-line-integration.md)** — 系統規格書（架構、API、Schema、設計決策紀錄 D1~D10）

---

## 🛡 安全性

- `JWT_SECRET` 在生產環境必填（fail-fast，不允許硬編碼預設值）
- 雙 audience JWT：customer 無法存取 admin endpoint，反之亦然
- CORS 白名單 + LIFF 子網域放行
- Rate limiting：登入 5/min、LINE auth 20/min、預約 10/hr
- LINE Webhook HMAC-SHA256 簽章驗證（`timingSafeEqual`）
- LINE 一鍵確認預約：`adminLineUserIds` 白名單機制
- 完整 admin 操作稽核日誌（含 LINE 內 postback 操作）
- bcrypt 加鹽雜湊管理員密碼

---

## 📄 License

ISC · Shane
