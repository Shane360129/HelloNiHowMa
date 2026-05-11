# La Paisley 雲端部署 + LINE 生態整合規格書

> **版本**：v1.0 (Draft)
> **撰寫日期**：2026-05-11
> **作者**：Shane / Claude
> **狀態**：待 Shane 審閱

---

## 1. 文件目的

本文件描述將 La Paisley 預約網站從本地專案部署至雲端、並整合 LINE 完整生態（Login、LIFF、Messaging API Webhook、自動提醒）的詳細技術規格與實作計畫。

文件涵蓋：

- 雲端架構與服務選型
- LINE Developers Console 申請步驟
- 資料庫 Schema 變更
- API 端點規格
- 前端流程設計
- 環境變數與設定
- 安全性考量
- 部署與測試計畫
- 開發里程碑

---

## 2. 架構總覽

### 2.1 系統架構圖

```
┌──────────────────────────────────────────────────────────────────┐
│                          終端用戶（客戶）                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐    │
│  │  瀏覽器網站  │    │  LINE App    │    │  LINE App        │    │
│  │  (lapaisley  │    │  (LIFF 預約) │    │  (OA 聊天機器人) │    │
│  │   .com)      │    │              │    │                  │    │
│  └──────┬───────┘    └──────┬───────┘    └─────────┬────────┘    │
└─────────┼───────────────────┼──────────────────────┼─────────────┘
          │                   │                      │
          │                   │                      │ Webhook
          ▼                   ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│              Cloudflare (DNS / CDN / WAF / SSL)                   │
└──────────────────────────────────────────┬───────────────────────┘
                                           │
                                           ▼
┌──────────────────────────────────────────────────────────────────┐
│           Render Web Service (Node.js + React static)             │
│                                                                   │
│  ┌─────────────────────┐    ┌─────────────────────────────┐      │
│  │  Express API        │    │  React SPA (Vite build)     │      │
│  │  - /api/auth/line   │    │  - 公開前台                  │      │
│  │  - /api/bookings    │◀──▶│  - LIFF 預約頁               │      │
│  │  - /api/line/webhook│    │  - 管理後台                  │      │
│  │  - /api/admin/*     │    │  - 我的預約                  │      │
│  └─────────┬───────────┘    └─────────────────────────────┘      │
└────────────┼─────────────────────────────────────────────────────┘
             │
             ├──────────────────┬─────────────────────┐
             ▼                  ▼                     ▼
   ┌──────────────────┐  ┌────────────────┐  ┌──────────────────┐
   │  Supabase        │  │  LINE Platform │  │  Render Cron Job │
   │  PostgreSQL Pro  │  │  Messaging API │  │  每日預約提醒    │
   └──────────────────┘  └────────────────┘  └──────────────────┘
```

### 2.2 技術選型

| 類別 | 技術 | 理由 |
|------|------|------|
| 邊緣層 | Cloudflare | 自有網域 DNS、CDN 加速、WAF 防護、免費 SSL、隱藏真實 IP |
| 應用層 | Render Standard | 已有 `render.yaml`，零停機部署、自動擴展、Health Check |
| 資料層 | Supabase Pro | 真實 PostgreSQL 15、自動備份、PITR、未來可擴充 Storage |
| 排程 | Render Cron Job | 每日提醒推播 |
| 前端 | React 19 + Vite 8 | 維持現有技術棧 |
| 後端 | Express 5 + Sequelize 6 | 維持現有技術棧 |
| LINE SDK | `@line/liff` + `@line/bot-sdk` | 官方 SDK |
| 認證 | JWT（短期 token）+ Refresh Token | 客戶與管理員分開 audience |

### 2.3 月度成本預估

| 服務 | 方案 | 月費 (USD) |
|------|------|------------|
| Cloudflare | Free | $0 |
| 網域 | `.com` 註冊費 | ~$1（約 $12/年） |
| Render Web | Standard (2GB) | $25 |
| Supabase | Pro | $25 |
| **合計** | | **~$51 / 月** |

> 啟動期可先用 Render Starter ($7) + Supabase Free，總費用降至約 $7/月，待業務量增加再升級。

---

## 3. LINE Developers 設定步驟

### 3.1 前置作業（Shane 需親自完成）

#### Step 1：建立 Provider
1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 建立新的 Provider，命名為 `La Paisley`

#### Step 2：建立 Messaging API Channel（綁定現有官方帳號）
1. 在 Provider 底下「Create a Messaging API Channel」
2. 連結到現有的 LINE 官方帳號
3. 取得以下憑證：
   - **Channel ID**
   - **Channel Secret**
   - **Channel Access Token (long-lived)**
4. **Webhook 設定**：
   - Webhook URL：`https://你的網域/api/line/webhook`（先填 Render 子網域，正式上線後改自有網域）
   - Use webhook：✅ 開啟
   - Auto-reply messages：❌ 關閉（在 LINE Official Account Manager 設定）
   - Greeting messages：可選

#### Step 3：建立 LINE Login Channel（同一 Provider）
1. 在 Provider 底下「Create a LINE Login Channel」
2. 取得：
   - **Channel ID**
   - **Channel Secret**
3. **設定**：
   - App Type：✅ Web app、✅ Native app（給 LIFF 用）
   - Callback URL：`https://你的網域/api/auth/line/callback`
   - Scope：`profile`, `openid`, `email`（若需 email 需另外申請）

#### Step 4：建立 LIFF App（在 Login Channel 底下）
1. 在 LINE Login Channel 內「LIFF」分頁建立 App
2. 設定：
   - **Endpoint URL**：`https://你的網域/booking?liff=1`
   - **Size**：`Full`
   - **Scope**：`profile`, `openid`
   - **Bot link**：`Aggressive`（讓 LIFF 使用者自動 follow 官方帳號）
3. 取得 **LIFF ID**

#### Step 5：LINE Official Account Manager 設定
1. 登入 [LINE OA Manager](https://manager.line.biz/)
2. 設定 → 回應設定：
   - **聊天**：開啟
   - **Webhook**：開啟
   - **自動回應訊息**：關閉
   - **加入好友的歡迎訊息**：開啟（可自訂歡迎詞）
3. 設定 Rich Menu（圖文選單）— 後續會由我提供模板與設定指引

### 3.2 環境變數對照

| 變數名稱 | 取得來源 | 用途 |
|----------|----------|------|
| `LINE_LOGIN_CHANNEL_ID` | Login Channel | OAuth client id |
| `LINE_LOGIN_CHANNEL_SECRET` | Login Channel | OAuth client secret |
| `LINE_LOGIN_CALLBACK_URL` | 自訂 | OAuth redirect uri |
| `LINE_LIFF_ID` | LIFF App | 前端初始化 LIFF |
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | Messaging API Channel | 推播訊息 |
| `LINE_MESSAGING_CHANNEL_SECRET` | Messaging API Channel | Webhook 簽章驗證 |
| `LINE_OA_BASIC_ID` | OA Manager | Rich Menu / Deep Link 用 |

---

## 4. 資料庫 Schema 變更

### 4.1 新增 `users` 表

```js
// server/models/User.js
{
  id:           INTEGER PK AUTO_INCREMENT,
  lineUserId:   STRING UNIQUE NOT NULL,   // LINE 提供的 U[a-f0-9]{32}
  displayName:  STRING NOT NULL,
  pictureUrl:   STRING DEFAULT '',
  email:        STRING DEFAULT '',         // 需 email scope, 可為空
  phone:        STRING DEFAULT '',         // 第一次預約時補填
  statusMessage: STRING DEFAULT '',
  language:     STRING DEFAULT 'zh-TW',
  isFollowingOA: BOOLEAN DEFAULT false,    // 是否已 follow 官方帳號
  lastLoginAt:  DATE,
  createdAt:    DATE,
  updatedAt:    DATE
}
```

**索引**：
- `UNIQUE INDEX` on `lineUserId`
- `INDEX` on `phone`（管理員搜尋用）

### 4.2 修改 `bookings` 表

```diff
  {
    id:               INTEGER PK,
    name:             STRING NOT NULL,
    phone:            STRING NOT NULL,
    lineId:           STRING DEFAULT '',
+   userId:           INTEGER NULL FK -> users.id,  // 登入用戶綁定
    service:          STRING NOT NULL,
    date:             STRING NOT NULL,
    time:             STRING NOT NULL,
    durationMinutes:  INTEGER DEFAULT 210,
    notes:            TEXT,
    status:           ENUM('pending','confirmed','completed','cancelled'),
+   reminderSentAt:   DATE NULL,            // 已發送提醒的時間戳記
    createdAt:        DATE
  }
```

**索引**：
- `INDEX` on `userId`（查我的預約用）
- `INDEX` on `(date, status)`（cron job 撈待提醒清單用）

### 4.3 新增 `line_webhook_events` 表（稽核 + 防重）

```js
{
  id:           BIGINT PK AUTO_INCREMENT,
  webhookEventId: STRING UNIQUE NOT NULL,  // LINE 提供的 event id
  type:         STRING NOT NULL,           // message, follow, unfollow, postback...
  userId:       INTEGER FK -> users.id,
  rawPayload:   JSONB,
  processedAt:  DATE,
  createdAt:    DATE
}
```

**用途**：避免 LINE 重送導致重複處理；管理員 debug 時可查 raw payload。

### 4.4 移除欄位

`settings.lineNotifyToken` — LINE Notify 已於 2025/3 終止，移除相關欄位與程式碼。

---

## 5. API 規格

### 5.1 客戶端認證

#### `GET /api/auth/line/authorize`

啟動 OAuth 授權流程。

**Response**：302 redirect 到 LINE 授權頁
**Query params**（內部使用）：
- `state`：CSRF token，存 session/cookie

#### `GET /api/auth/line/callback`

LINE 重導回的 callback。

**Query**：`code`, `state`
**流程**：
1. 驗證 `state` 防 CSRF
2. 用 `code` 換 LINE access token
3. 取得 LINE profile (`/v2/profile`)
4. Upsert User 表
5. 簽 JWT（audience: `customer`, expires: 7 days）
6. Redirect 到 `/?token=<jwt>` 或設 HttpOnly cookie

**Response**：302 redirect 到前台

#### `POST /api/auth/line/liff-token`

LIFF 內取得 server JWT。

**Body**：`{ idToken: string }`（LIFF SDK 拿到的 ID token）
**流程**：
1. 用 LINE OAuth API 驗證 `idToken`
2. Upsert User
3. 回傳 server JWT
**Response**：`{ token: string, user: { displayName, pictureUrl } }`

#### `GET /api/auth/me`

取得當前登入用戶資訊（需 customer JWT）。
**Response**：`{ id, lineUserId, displayName, pictureUrl, phone, email }`

#### `POST /api/auth/logout`

清除 cookie / 撤銷 token。

### 5.2 預約 API（修改）

#### `POST /api/bookings`

**變更**：強制要求 customer JWT。

**Headers**：`Authorization: Bearer <customer_jwt>`
**Body**：
```json
{
  "phone": "0912345678",
  "service": "韓式霧眉",
  "date": "2026-06-01",
  "time": "10:00",
  "notes": "首次預約"
}
```

**注意**：
- `name` 從登入用戶的 `displayName` 自動帶入（可在 body 覆寫）
- `lineId` 從用戶的 `lineUserId` 自動帶入
- 沒有 token 直接回 401（前端引導至 LINE 登入）

#### `GET /api/me/bookings`（新增）

查自己的預約列表。

**Headers**：`Authorization: Bearer <customer_jwt>`
**Query**：`?status=pending,confirmed`（可選）
**Response**：`Booking[]`

#### `PATCH /api/me/bookings/:id/cancel`（新增）

取消自己的預約。

- 只能取消 `pending` 或 `confirmed` 狀態
- 距離預約時間 < 24 小時不允許取消（可設定）

### 5.3 LINE Webhook

#### `POST /api/line/webhook`

接收 LINE 平台事件。

**Headers**：`x-line-signature: <hmac>`
**簽章驗證**：HMAC-SHA256(`channelSecret`, requestBody) 比對 `x-line-signature`

**處理的事件**：

| Event Type | 處理邏輯 |
|------------|----------|
| `follow` | 用戶加入官方帳號 → 標記 `isFollowingOA=true` → 推送歡迎訊息 + Rich Menu |
| `unfollow` | 標記 `isFollowingOA=false` |
| `message.text` | 解析指令：「查預約」「取消」「營業時間」「聯絡」 |
| `postback` | Rich Menu 按鈕、Flex Message 按鈕 |

**Response**：必須 200 回應 LINE，否則會被視為失敗並重試。

### 5.4 管理員 API

新增：

#### `GET /api/admin/users`
列出所有註冊用戶（含預約次數統計）。

#### `POST /api/admin/users/:id/message`
管理員透過後台主動推訊息給單一用戶。

其餘 admin API 不變。

---

## 6. 前端流程設計

### 6.1 登入流程（瀏覽器）

```
[使用者點預約] 
    │
    ▼
[未登入] ──── 「請先以 LINE 登入」按鈕
    │
    ▼
[點擊登入] ─── 302 ─▶ LINE Login
    │                      │
    │                      ▼
    │              [LINE 授權頁]
    │                      │
    │                      ▼
    └──── 302 ─── /api/auth/line/callback
                          │
                          ▼
                  簽 JWT → cookie
                          │
                          ▼
                  302 → /booking
                          │
                          ▼
                  已登入，姓名/LINE ID 自動帶入
```

### 6.2 登入流程（LIFF 內）

```
[從 LINE Rich Menu 開啟]
    │
    ▼
[LIFF App 載入]
    │
    ├─ liff.init({ liffId })
    │
    ├─ liff.isLoggedIn()? ─── No ─▶ liff.login()
    │       │
    │       Yes
    │       │
    │       ▼
    └─ liff.getIDToken()
                │
                ▼
        POST /api/auth/line/liff-token
                │
                ▼
        取得 server JWT，存 sessionStorage
                │
                ▼
        進入預約頁，姓名/頭像/LINE ID 自動帶入
```

### 6.3 預約頁變更

| 欄位 | 變更 |
|------|------|
| 姓名 | 自動帶入 `displayName`，可編輯 |
| 電話 | 第一次預約必填，存入 User profile，下次自動帶入 |
| LINE ID | 自動帶入，隱藏不顯示 |
| 項目 / 日期 / 時間 / 備註 | 不變 |

新增：
- 「我的預約」入口（Navbar，登入後顯示）
- 「LINE 登入」按鈕（未登入時顯示）
- 「登出」（登入後 dropdown）

### 6.4 我的預約頁 `/me/bookings`

- 列表顯示：日期時間、服務、狀態 badge
- 點開可看詳情、取消（符合條件時）
- 切換 tab：未完成 / 已完成 / 已取消

---

## 7. LINE 聊天機器人指令

### 7.1 文字指令

| 用戶輸入 | 回應 |
|----------|------|
| `查預約` / `我的預約` | 回傳 Flex Message 列表 |
| `取消預約` | 引導到「我的預約」LIFF 連結 |
| `預約` / `想預約` | 回傳 LIFF 預約頁連結 |
| `營業時間` | 從 Setting 撈即時資料回覆 |
| `聯絡` / `地址` | 回 Profile 中的聯絡資訊 |
| `菜單` / `價目表` | 回 Flex Message 服務項目卡片 |
| 其他 | 「請點下方選單，或輸入『預約』『查預約』」 |

### 7.2 Rich Menu 結構

```
┌──────────────────────────────────────┐
│                                      │
│   立即預約 (LIFF)    我的預約 (LIFF) │
│                                      │
├──────────────────────────────────────┤
│                                      │
│   服務項目          作品集            │
│                                      │
├──────────────────────────────────────┤
│                                      │
│   營業時間          聯絡我們          │
│                                      │
└──────────────────────────────────────┘
```

每個區塊對應 `postback` 或 `uri` action。

### 7.3 自動提醒（Cron Job）

**排程**：每日 10:00 (Asia/Taipei)
**邏輯**：
1. 撈出 `date = 明天` 且 `status IN (pending, confirmed)` 且 `reminderSentAt IS NULL` 的 booking
2. 對每筆推送 Flex Message：「您明天 14:00 有一場霧眉預約，請準時赴約 ❤️」
3. 更新 `reminderSentAt = now()`

**Render 設定**：
```yaml
# render.yaml
- type: cron
  name: la-paisley-reminder
  schedule: "0 2 * * *"  # UTC 02:00 = 台北 10:00
  buildCommand: cd server && npm install
  startCommand: cd server && node jobs/sendReminders.js
```

---

## 8. 環境變數總清單

```bash
# === 基礎 ===
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...@db.xxx.supabase.co:5432/postgres

# === 認證 ===
JWT_SECRET=<32+ 位元亂數>            # 必填,不再有預設值
JWT_CUSTOMER_EXPIRES=7d
JWT_ADMIN_EXPIRES=24h

# === LINE Login + LIFF ===
LINE_LOGIN_CHANNEL_ID=2001234567
LINE_LOGIN_CHANNEL_SECRET=<secret>
LINE_LOGIN_CALLBACK_URL=https://lapaisley.com/api/auth/line/callback
LINE_LIFF_ID=2001234567-AbCdEfGh

# === LINE Messaging API ===
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=<long-lived token>
LINE_MESSAGING_CHANNEL_SECRET=<secret>
LINE_OA_BASIC_ID=@lapaisley

# === 前端 ===
VITE_LIFF_ID=2001234567-AbCdEfGh   # client 端用
VITE_LINE_LOGIN_URL=/api/auth/line/authorize

# === 預約 ===
BOOKING_TZ_OFFSET_MINUTES=480
BOOKING_CANCEL_HOURS_LIMIT=24      # 距離預約 N 小時內不可取消

# === 通知對象 (店家) ===
LINE_TARGET_ID=<店家 userId / groupId>
```

---

## 9. 安全性考量

### 9.1 必修的現有問題

1. **JWT_SECRET 硬編碼 fallback**（`server/index.js:23`）：
   - 拿掉 `|| 'la-paisley-admin-secret-key-2025'`
   - 啟動時若無環境變數則 fail-fast

2. **CORS 全開**：
   - 改為白名單：`https://lapaisley.com`, `https://*.line.me`（LIFF 來源）

3. **沒有 rate limit**：
   - 加 `express-rate-limit`：
     - 登入 endpoint：5 次 / 分鐘 / IP
     - 預約 endpoint：10 次 / 小時 / IP

### 9.2 LINE 整合相關

1. **OAuth `state` 驗證**：
   - 簽 short-lived JWT 當 state（含 timestamp + nonce），存 cookie，callback 時對比

2. **LIFF idToken 驗證**：
   - 收到後必須打 `https://api.line.me/oauth2/v2.1/verify` 驗證
   - 不可直接信任前端傳來的 userId

3. **Webhook 簽章驗證**：
   - HMAC-SHA256(`channelSecret`, rawBody) base64 比對 `x-line-signature`
   - 驗證失敗回 401
   - **必須用 raw body**（Express middleware 順序很重要）

4. **Webhook event 去重**：
   - 寫入 `line_webhook_events` 表前先檢查 `webhookEventId` 是否已存在

### 9.3 一般 Web 安全

| 項目 | 措施 |
|------|------|
| HTTPS | Cloudflare 自動 SSL（Full Strict）+ Render 自動 |
| 敏感欄位 | Cloudflare 設定 Bot Fight Mode、WAF managed rules |
| SQL Injection | Sequelize 預編譯參數，已防 |
| XSS | React 自動 escape；管理後台 `dangerouslySetInnerHTML` 全面審查 |
| CSRF | 客戶端 JWT 走 Authorization header（非 cookie）；若改用 cookie 需加 SameSite=Strict + CSRF token |
| 密碼儲存 | bcrypt（已實作）|
| 環境變數洩漏 | `.env` 全部進 `.gitignore`；Render Secret Files |

---

## 10. 部署步驟

### 10.1 準備階段（一次性）

1. **購買網域**（推薦 Cloudflare Registrar，含 WHOIS 隱私）
2. **建立 Cloudflare 帳號**，把網域 DNS 指向 Cloudflare
3. **建立 Supabase Pro 專案**，取得 `DATABASE_URL`
4. **建立 Render 帳號** 並連結 GitHub repo
5. **完成 LINE Developers Console 所有 Channel 申請**（見 §3.1）

### 10.2 Render 部署

1. Render Dashboard → New → Blueprint
2. 連結到 `Shane360129/hellonihowma` repo
3. 選擇分支 `main`
4. 確認讀到更新後的 `render.yaml`
5. 填入所有環境變數（見 §8）
6. 點 Apply
7. 等待第一次部署完成（約 5-10 分鐘）

### 10.3 自有網域綁定

1. Render → Service → Settings → Custom Domain → 新增 `lapaisley.com`
2. Cloudflare → DNS → 新增 CNAME 指向 Render 提供的 `xxx.onrender.com`
3. Cloudflare → SSL/TLS → 設為 `Full (strict)`
4. Cloudflare → Page Rules：強制 HTTPS
5. 等 DNS 生效後，將 LINE Developers Console 內所有 URL 改為新網域

### 10.4 驗證清單

- [ ] `https://lapaisley.com` 可正常開啟
- [ ] `/api/health` 回應 200
- [ ] 管理後台 `/admin` 可登入
- [ ] LINE 登入 flow 完整跑通
- [ ] LIFF App 在 LINE 內可開啟並自動登入
- [ ] 加入官方帳號觸發 follow webhook，收到歡迎訊息
- [ ] 預約成立後客戶與店家都收到 LINE 通知
- [ ] Rich Menu 顯示正常，按鈕可點
- [ ] Cron Job 每日提醒可執行（手動觸發測試）

---

## 11. 測試計畫

### 11.1 單元測試（建議新增）

- `availability.js` 時段計算邏輯
- LINE webhook 簽章驗證
- JWT 簽發與驗證

### 11.2 整合測試情境

| 情境 | 預期結果 |
|------|----------|
| 未登入直接打 `POST /api/bookings` | 401 Unauthorized |
| 登入後預約，姓名留空 | 用 `displayName` 代入 |
| 同一時段重複預約 | 第二筆回 400 「此時段已被預約」 |
| 預約後 5 秒，店家手機收到 LINE 通知 | ✅ |
| 預約後 5 秒，客戶收到 LINE 通知 | ✅ |
| 取消預約，狀態變更 | ✅ |
| 預約前 24 小時內嘗試取消 | 400 拒絕 |
| Webhook 簽章錯誤 | 401 拒絕 |
| 同一 webhook event 重送兩次 | 第二次幂等（不重複處理） |
| 從 Rich Menu 點預約 → LIFF 開啟 → 預約成功 | 全程順暢 |

### 11.3 LIFF 測試

LINE 提供 [LIFF Inspector](https://developers.line.biz/en/docs/liff/use-liff-inspector/) 可在本機 Chrome 模擬 LIFF 環境。

---

## 12. 開發里程碑

| Phase | 內容 | 預估工時 |
|-------|------|----------|
| **Phase 1** | 部署整備：移除 LINE Notify、修補安全漏洞、Supabase 連線、Health Check | 1-2 天 |
| **Phase 2** | LINE Login：User model、OAuth flow、JWT、我的預約頁 | 3-4 天 |
| **Phase 3** | LIFF 整合：LIFF SDK、Rich Menu 圖片與設定 | 1-2 天 |
| **Phase 4** | Messaging API：Webhook、機器人指令、Flex Message、自動提醒 Cron | 3-4 天 |
| **Phase 5** | 測試 + 部署 + 網域綁定 + 上線監控 | 2 天 |
| **合計** | | **10-14 天** |

---

## 13. 開發順序建議

```
Phase 1 ─▶ Phase 2 ─▶ Phase 3 ─▶ Phase 4 ─▶ Phase 5
   │           │           │           │           │
   ▼           ▼           ▼           ▼           ▼
基礎          會員          LINE 內      雙向         上線
建設          系統          無縫預約    聊天機器人   驗收
```

**理由**：每個 Phase 結束都是可獨立部署的版本，可逐步上線測試，降低風險。

---

## 14. 風險與緩解

| 風險 | 影響 | 緩解 |
|------|------|------|
| LINE 審核延遲 | LIFF / Login 無法使用 | 提早申請，Channel 申請後立即可用，不需審核 |
| Webhook 重送導致重複處理 | 客戶收到多則通知 | 用 `webhookEventId` 去重表 |
| Render free PostgreSQL 90 天過期 | 服務中斷 | 直接用 Supabase Pro，跳過此問題 |
| LINE 用戶 unfollow 後 push 失敗 | 推播浪費 quota | 偵測 `unfollow` event 並更新 `isFollowingOA` |
| 客戶手機沒裝 LINE | 無法登入 | 提供「電話預約」備援按鈕（顯示店家電話） |
| LIFF 內 cookie 限制 | 認證失效 | 改用 sessionStorage + Authorization header |

---

## 15. 後續延伸（v2.0 構想，本期不做）

- LINE Pay 收訂金
- 多語系（簡中、英）
- 客戶評價與作品授權
- 集點卡 / 老客戶 VIP 制度
- Google Analytics + LINE Tag for marketing
- 管理員 LINE Bot（店家主管理員透過 LINE 收預約、回覆）

---

## 16. 待 Shane 確認事項

- [ ] 雲端架構是否採 **Render + Supabase + Cloudflare**？
- [ ] 預計購買的網域名稱（用於 Channel 設定）？
- [ ] 是否需要 email 欄位（會增加 LINE Login 申請手續）？
- [ ] Phase 2、3、4 是否依序推進，每階段都 PR 給你 review？
- [ ] 月費預算上限（影響 Render / Supabase 方案選擇）？

---

**文件版本歷史**

| 版本 | 日期 | 變更 |
|------|------|------|
| v1.0 | 2026-05-11 | 初版 |
