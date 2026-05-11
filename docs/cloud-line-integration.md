# La Paisley 雲端部署 + LINE 生態整合規格書

> **版本**：v1.2 (Draft)
> **撰寫日期**：2026-05-11
> **作者**：Shane / Claude
> **狀態**：待 Shane 審閱

---

## 📌 決策紀錄（Resolved）

以下為 Shane 已確認的關鍵設計決策，後續實作以此為準：

| # | 議題 | 決議 |
|---|------|------|
| D1 | 強制 LINE 登入才能預約 | **預設 ON**（`settings.lineLoginRequired = true`） |
| D2 | 後台代客建立預約時的推播策略 | 建立時**不推播**；待管理員把狀態改為 `confirmed` 才推播「預約成功」訊息給客戶 |
| D3 | 每日預約提醒時間 | **店家可在後台自訂**（`settings.reminderTime`，預設 10:00） |
| D4 | 店家收到的新預約通知格式 | **Flex Message**，含「✅ 確認預約」「❌ 取消預約」「📋 查看詳情」按鈕，店家在 LINE 內可一鍵更新狀態 |
| D5 | 開發節奏 | 全部 Phase 在 `claude/analyze-project-content-0kt37` 分支完成後，**一次合併**為單一 PR |

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
+   userId:           INTEGER NULL FK -> users.id,    // 登入客戶綁定，可空
    service:          STRING NOT NULL,
    date:             STRING NOT NULL,
    time:             STRING NOT NULL,
    durationMinutes:  INTEGER DEFAULT 210,
    notes:            TEXT,                            // 客戶填寫的備註
+   internalNotes:    TEXT DEFAULT '',                  // 內部備註，僅後台可見
    status:           ENUM('pending','confirmed','completed','cancelled'),
+   source:           ENUM('customer_self','admin_phone','admin_dm','walk_in')
+                     DEFAULT 'customer_self',         // 預約來源
+   createdByAdminId: INTEGER NULL FK -> admins.id,   // 若由後台建立，記錄管理員
+   reminderSentAt:   DATE NULL,                       // 已發送提醒時間
    createdAt:        DATE
  }
```

**索引**：
- `INDEX` on `userId`（查我的預約用）
- `INDEX` on `(date, status)`（cron job 撈待提醒清單）
- `INDEX` on `source`（後台統計來源分布）
- `INDEX` on `phone`（同電話客戶歷史查詢）

**`source` 欄位語意**：
| 值 | 來源 | 是否推播 LINE 給客戶 |
|----|------|----------------------|
| `customer_self` | 客戶自己用網站/LIFF 預約 | ✅ 是 |
| `admin_phone` | 後台電話預約 | ❌ 否（除非有 LINE userId） |
| `admin_dm` | 後台 LINE 私訊預約 | ✅ 若有 userId |
| `walk_in` | 走入店面當場預約 | ❌ 否 |

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

### 4.4 新增 `message_templates` 表（LINE 訊息模板）

```js
{
  id:           INTEGER PK AUTO_INCREMENT,
  key:          STRING UNIQUE NOT NULL,    // 'booking_created_customer' 等
  name:         STRING NOT NULL,            // 後台顯示用名稱
  description:  STRING DEFAULT '',
  enabled:      BOOLEAN DEFAULT true,
  channel:      ENUM('line_text','line_flex') DEFAULT 'line_text',
  content:      TEXT NOT NULL,              // {變數} 格式
  flexJson:     JSONB NULL,                 // 若為 flex，存 JSON 範本
  variables:    JSONB DEFAULT '[]',         // 可用變數清單（提示用）
  updatedBy:    STRING,
  updatedAt:    DATE,
  createdAt:    DATE
}
```

**預設 seed 的模板 key**：

| Key | 觸發時機 | 收件對象 | 預設格式 | 預設啟用 |
|-----|----------|----------|----------|----------|
| `booking_created_customer` | **客戶自己**送出預約成立（`source=customer_self`） | 客戶 | text | ✅ |
| `booking_created_store` | **客戶自己**送出預約成立 | 店家 | **flex**（含確認按鈕，見 §7.4） | ✅ |
| `booking_confirmed_customer` | 任何預約被店家標記 `confirmed`（含後台代客預約確認） | 客戶 | text | ✅ |
| `booking_completed_customer` | 服務完成 | 客戶 | text | ⬜ |
| `booking_cancelled_customer` | 預約取消 | 客戶 | text | ✅ |
| `booking_reminder` | 預約前 N 天 / 時間依 `settings.reminderTime` | 客戶 | text | ✅ |
| `oa_welcome` | 新追蹤者加入 | 客戶 | flex | ✅ |

**觸發規則細節（依 D2 決策）**：
- **客戶自己預約** → 立即觸發 `booking_created_customer`（給客戶）+ `booking_created_store` Flex（給店家）
- **後台代客預約**（任何 `source` 非 `customer_self`） → 建立時**不**觸發任何模板。直到店家把狀態改為 `confirmed`，才觸發 `booking_confirmed_customer`（需有 LINE userId 才推播）

**可用變數**：
`{name}`, `{date}`, `{time}`, `{endTime}`, `{service}`, `{phone}`, `{notes}`, `{duration}`, `{storeName}`, `{storeAddress}`, `{storePhone}`, `{cancelUrl}`, `{rescheduleUrl}`

### 4.5 新增 `broadcasts` 表（推播歷史）

```js
{
  id:                BIGINT PK AUTO_INCREMENT,
  type:              ENUM('single','tag','all_followers') NOT NULL,
  recipientUserIds:  JSONB DEFAULT '[]',    // 目標 user.id 陣列
  recipientTags:     JSONB DEFAULT '[]',    // 若 type=tag
  messageType:       ENUM('text','flex','image') DEFAULT 'text',
  content:           TEXT NOT NULL,
  flexJson:          JSONB NULL,
  imageUrl:          STRING DEFAULT '',
  scheduledAt:       DATE NULL,             // 排程發送時間
  status:            ENUM('draft','queued','sending','sent','failed','cancelled')
                     DEFAULT 'draft',
  successCount:      INTEGER DEFAULT 0,
  failureCount:      INTEGER DEFAULT 0,
  failureDetails:    JSONB DEFAULT '[]',    // [{userId, error}]
  sentBy:            STRING NOT NULL,        // admin username
  sentAt:            DATE NULL,
  createdAt:         DATE
}
```

**索引**：
- `INDEX` on `(status, scheduledAt)`（cron 撈待發清單）
- `INDEX` on `sentBy`

### 4.6 新增 `admin_audit_logs` 表（操作稽核）

```js
{
  id:           BIGINT PK AUTO_INCREMENT,
  adminId:      INTEGER FK -> admins.id,
  action:       STRING NOT NULL,    // 'booking.create' 'broadcast.send' ...
  targetType:   STRING,              // 'Booking' 'Service' 'User'
  targetId:     STRING,
  diff:         JSONB DEFAULT '{}',  // 變更前後對照（選填）
  ip:           STRING,
  userAgent:    STRING,
  createdAt:    DATE
}
```

**索引**：
- `INDEX` on `(adminId, createdAt)`
- `INDEX` on `(targetType, targetId)`

### 4.7 擴充 `users` 表

```diff
  {
    ...（原欄位）
+   tags:         JSONB DEFAULT '[]',     // ['VIP','新客','黑名單'...] 自訂標籤
+   notes:        TEXT DEFAULT '',         // 管理員備註
+   blocked:      BOOLEAN DEFAULT false,   // 黑名單（禁止預約）
  }
```

### 4.8 擴充 `settings` 表（預約規則 + 提醒）

```diff
  {
    ...（原欄位）
+   bookingBufferMinutes:    INTEGER DEFAULT 0,    // 每筆預約前後緩衝（分鐘）
+   bookingEarliestDays:     INTEGER DEFAULT 1,    // 最早可預約幾天後
+   bookingLatestHours:      INTEGER DEFAULT 24,   // 最晚可預約幾小時前
+   bookingCancelHoursLimit: INTEGER DEFAULT 24,   // 距預約 N 小時內不可取消
+   bookingPerUserPerWeek:   INTEGER DEFAULT 0,    // 0=不限
+   lineLoginRequired:       BOOLEAN DEFAULT true, // 強制 LINE 登入才能預約 (D1)
+   reminderEnabled:         BOOLEAN DEFAULT true, // 是否啟用每日提醒
+   reminderTime:            STRING  DEFAULT '10:00', // 提醒發送時間 HH:MM (D3)
+   reminderLeadDays:        INTEGER DEFAULT 1,    // 提前幾天提醒（1=前一天）
+   adminLineUserIds:        JSONB   DEFAULT '[]', // 可在 LINE 一鍵確認預約的店員 userId 白名單 (D4)
+   pushQuotaWarnThreshold:  INTEGER DEFAULT 50,   // 推播配額剩 N 則時警告
  }
```

### 4.9 移除欄位

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

### 5.4 管理員 API（原有）

維持現行 admin API（services / works / news / profile / bookings CRUD）並擴充以下：

### 5.5 管理員 — 預約進階

#### `POST /api/admin/bookings`（新增）
**用途**：管理員代客建立預約（電話 / 私訊 / 走入）。

**Headers**：`Authorization: Bearer <admin_jwt>`
**Body**：
```json
{
  "name": "王小姐",
  "phone": "0912345678",
  "lineId": "",
  "service": "韓式霧眉",
  "date": "2026-06-01",
  "time": "10:00",
  "durationMinutes": 210,
  "notes": "",
  "internalNotes": "老客戶介紹",
  "source": "admin_phone",
  "userId": null,
  "status": "pending",
  "ignoreConflict": false
}
```

**處理邏輯**（依 D2 決策）：
1. 驗證 admin JWT
2. 若 `ignoreConflict=false`，跑 `validateBookingSlot()`；否則跳過
3. 若提供 `userId`，自動帶入該用戶的 LINE userId 與姓名
4. 建立 booking，記錄 `createdByAdminId` 與 `source`
5. **不**推播任何訊息給客戶（D2：等狀態改為 confirmed 才推）
6. **不**推播店家通知（admin 自己建立的，已知）
7. 若 `status === 'confirmed'`（admin 直接以已確認狀態建立）且 booking 有 LINE userId → 立即觸發 `booking_confirmed_customer`
8. 記錄 audit log

**設計理由**：D2 規定後台代客預約不在建立時打擾客戶（很多狀況是電話接洽中、客戶還沒最終答應），等店家確認時間後再發「預約成功」訊息。

#### `PATCH /api/admin/bookings/:id`（既有，補充狀態流轉副作用）

當 `status` 欄位變動時自動觸發對應模板（依 D2、D4 決策）：

| 狀態變化 | 觸發模板 | 條件 |
|----------|----------|------|
| `pending → confirmed` | `booking_confirmed_customer` | booking 有 LINE userId 且模板啟用 |
| `* → completed` | `booking_completed_customer` | 同上 |
| `* → cancelled` | `booking_cancelled_customer` | 同上 |

這也是 D2「後台確認預約後再推播預約成功訊息」的實作落點。

#### `PATCH /api/admin/bookings/:id/notify`（新增）
手動重發某一模板（修改後重發、漏發補發、測試用）。

**Body**：`{ "templateKey": "booking_confirmed_customer" }`

#### `POST /api/admin/bookings/bulk-status`（新增）
批次更新預約狀態。

**Body**：`{ "ids": [1,2,3], "status": "completed" }`

#### `GET /api/admin/bookings/calendar`（新增）
回傳月曆檢視所需資料（含時段、衝突警告、來源 badge）。

### 5.6 管理員 — 訊息模板

#### `GET /api/admin/message-templates`
列出所有模板。

#### `GET /api/admin/message-templates/:key`
取得單一模板（含可用變數清單）。

#### `PUT /api/admin/message-templates/:key`
更新模板內容 / 啟用狀態。

**Body**：
```json
{
  "enabled": true,
  "channel": "line_text",
  "content": "{name} 您好，您的 {service} 已預約成功 ✨\n日期：{date} {time}",
  "flexJson": null
}
```

#### `POST /api/admin/message-templates/:key/preview`
**用途**：用範例資料渲染模板，預覽實際送出的內容。
**Body**：`{ "sampleData": { "name": "王小姐", "date": "2026-06-01", ... } }`
**Response**：`{ "rendered": "王小姐 您好，..." }`

### 5.7 管理員 — 主動推播

#### `POST /api/admin/broadcasts`
**用途**：建立並發送（或排程）推播。

**Body**：
```json
{
  "type": "tag",
  "recipientTags": ["VIP"],
  "messageType": "text",
  "content": "夏季新優惠來囉 ✨",
  "scheduledAt": null
}
```

**處理邏輯**：
1. 解析 `type`：`single` → 用 `recipientUserIds`；`tag` → 撈出有對應 tag 的 user；`all_followers` → 撈 `isFollowingOA=true` 全部
2. 若 `scheduledAt` 為空 → 立即發送；否則寫入 broadcasts 表 status=queued
3. 對每位收件人呼叫 LINE Messaging API push
4. 統計 success/failure
5. 寫入 broadcasts 表
6. 記錄 audit log

**Response**：`{ id, successCount, failureCount, status }`

#### `GET /api/admin/broadcasts`
推播歷史列表。

#### `GET /api/admin/broadcasts/:id`
單筆詳情（含失敗清單）。

#### `POST /api/admin/broadcasts/:id/retry-failed`
重試失敗筆。

#### `DELETE /api/admin/broadcasts/:id`
取消尚未發送的排程推播（status=queued 才能刪）。

#### `GET /api/admin/line/quota`
LINE Messaging API 配額查詢。

**Response**：
```json
{
  "type": "limited",
  "quota": 500,
  "consumption": 123,
  "remaining": 377,
  "resetDate": "2026-06-01"
}
```

### 5.8 管理員 — 用戶管理

#### `GET /api/admin/users`
列出所有 LINE 註冊用戶。
**Query**：`?tag=VIP&search=王&isFollowing=true&page=1&pageSize=20`
**Response**：含每位用戶的預約次數、最後預約日、是否追蹤 OA。

#### `GET /api/admin/users/:id`
單一用戶詳情，含歷史預約、推播紀錄。

#### `PATCH /api/admin/users/:id`
更新用戶資訊（phone、tags、notes、blocked）。

#### `POST /api/admin/users/:id/message`
單發 LINE 訊息給該用戶（內部呼叫 broadcasts 流程，type=single）。

### 5.9 管理員 — 預約時間/規則

#### `GET /api/admin/availability`
**Response**：
```json
{
  "weeklySchedule": { "0": [...], "1": [...], ... },
  "dateOverrides": { "2026-06-15": [] },
  "rules": {
    "defaultBookingDuration": 210,
    "slotInterval": 30,
    "bufferMinutes": 0,
    "earliestDays": 1,
    "latestHours": 24,
    "cancelHoursLimit": 24,
    "perUserPerWeek": 0
  }
}
```

#### `PUT /api/admin/availability`
一次性更新所有預約時間/規則設定。

#### `POST /api/admin/availability/block-slot`
封鎖單一日期的特定時段（不影響其他天的同時段）。
**Body**：`{ "date": "2026-06-15", "start": "13:00", "end": "15:00", "reason": "教育訓練" }`

### 5.10 管理員 — 內容管理（原有 + 新增）

維持現有 services / works / news / profile CRUD，新增：

#### `POST /api/admin/uploads`
**用途**：圖片上傳（hero、頭像、作品、消息圖）。
**實作**：暫存於 Supabase Storage 或回傳 base64（v1.0 用 base64 簡化）。

#### `GET /api/admin/site-content`
一次拿到所有前台呈現的內容（給 Dashboard 預覽用）。

### 5.11 管理員 — 統計儀表板

#### `GET /api/admin/dashboard/stats`
**Response**：
```json
{
  "today": { "bookings": 3, "pending": 1 },
  "thisWeek": { "bookings": 12, "revenue": 58000 },
  "thisMonth": { "bookings": 45, "newUsers": 8 },
  "lineHealth": {
    "lastWebhookAt": "2026-05-11T08:00:00Z",
    "pushQuotaRemaining": 377
  }
}
```

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

### 6.5 後台代客預約流程（依 D2）

```
[後台 → 預約管理]
     │
     ▼
[點「+ 新增預約」]
     │
     ▼
┌────────────────────────────────────┐
│  Drawer 表單                       │
│  ──────────────────────────────   │
│  來源 *  [電話 ▼ 私訊 走入]        │
│  姓名 *  [_____________]           │
│  電話 *  [_____________]           │
│  ▶ 同電話客戶歷史: 3 筆 (展開)    │
│  LINE ID  [選填]                   │
│  └ 或從已註冊用戶選: [搜尋 ▼]      │
│  服務 *  [韓式霧眉 ▼]              │
│  日期 *  [行事曆]                  │
│  時間 *  [可預約時段 ▼]            │
│  ⚠ 此時段已被預約: ☐ 仍要建立     │
│  客戶備註  [_______________]       │
│  內部備註  [_______________]       │
│                                    │
│  建立後狀態:                       │
│   ● 待確認 (暫不通知客戶)          │
│   ○ 已確認 (立刻推播預約成功訊息)  │
│                                    │
│  [取消]  [建立]                    │
└────────────────────────────────────┘
     │
     ▼
[POST /api/admin/bookings]
     │
     ▼
[預設 status=pending → 不推播]
[列表新增一筆 (來源: 電話) 狀態: 待確認]
     │
     ▼
[管理員與客戶確認時間後]
     │
     ▼
[點該筆預約 → 改狀態為 confirmed]
     │
     ▼
[PATCH /api/admin/bookings/:id]
     │
     ▼
[觸發 booking_confirmed_customer 模板]
[若客戶有 LINE userId → 推播「預約成功」]
[若無 LINE userId → 僅紀錄，店家自行電話通知]
```

**Note**：表單不再有「自動推播」勾選 — 完全由狀態決定（D2）。

### 6.6 後台訊息模板編輯流程

```
[後台 → LINE 設定 → 訊息模板]
     │
     ▼
[列表顯示所有 template]
[預約成立(客)] ✅ 啟用    [編輯]
[預約成立(店)] ✅ 啟用    [編輯]
[已確認(客)]   ✅ 啟用    [編輯]
[完成(客)]     ⬜ 停用    [編輯]
...
     │
     ▼
[點編輯 → Modal]
┌────────────────────────────────────┐
│  Key: booking_created_customer     │
│  類型: ●純文字 ○Flex Message       │
│  啟用: ●是 ○否                     │
│                                    │
│  內容（左右並排）                  │
│  ┌───────────┐  ┌─────────────┐   │
│  │ 編輯區     │  │ 即時預覽    │   │
│  │ {name} 您好│  │ 王小姐 您好 │   │
│  │ 您的{service}預約已成立     │   │
│  │ 日期：{date} {time}         │   │
│  │            │  │ 日期: 2026-..│   │
│  └───────────┘  └─────────────┘   │
│                                    │
│  可用變數: {name} {date} {time} ...│
│  (點擊插入)                        │
│                                    │
│  [取消]  [儲存]                    │
└────────────────────────────────────┘
```

### 6.7 後台主動推播流程

```
[後台 → LINE 設定 → 主動推播]
     │
     ▼
[新增推播]
┌────────────────────────────────────┐
│  對象選擇:                         │
│    ● 單一用戶 [搜尋用戶 ▼]         │
│    ○ 標籤群組 [VIP ▼] (8 人)       │
│    ○ 全體追蹤者 (124 人)           │
│                                    │
│  訊息類型:                         │
│    ● 純文字  ○ Flex  ○ 圖片        │
│                                    │
│  內容:                             │
│  [_________________________]       │
│                                    │
│  排程:                             │
│    ● 立即發送                      │
│    ○ 排程 [日期 ___] [時間 __]    │
│                                    │
│  ⚠ 本月剩餘配額: 377 / 500        │
│  本次將消耗: 8 則                  │
│                                    │
│  [取消]  [預覽]  [確認發送]        │
└────────────────────────────────────┘
     │
     ▼
[二次確認 Modal]
     │
     ▼
[POST /api/admin/broadcasts → 立即執行]
     │
     ▼
[結果頁: 成功 7, 失敗 1 (點開看原因)]
```

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

### 7.3 自動提醒（Cron Job，依 D3）

**設計目標**：店家可在後台自訂提醒時間，**不需重新部署即可生效**。

**排程**：cron 每小時整點執行一次（24 次/天），由程式內邏輯比對 `settings.reminderTime` 決定是否實際送出。

**邏輯**：
1. 讀取 `settings`，取得 `reminderEnabled`、`reminderTime`（HH:MM）、`reminderLeadDays`
2. 若 `reminderEnabled=false` 直接結束
3. 計算現在時間（台北時區），與 `reminderTime` 比對：
   - 若小時不符 → 直接結束（保留每整點都跑的彈性）
   - 若小時相符且分鐘 ≤ 30 → 繼續
4. 計算目標日期：`今天 + reminderLeadDays`
5. 撈出 `date = 目標日期` 且 `status IN (pending, confirmed)` 且 `reminderSentAt IS NULL` 的 booking
6. 對每筆套 `booking_reminder` 模板推送
7. 更新 `reminderSentAt = now()`

**Render 設定**：
```yaml
# render.yaml
- type: cron
  name: la-paisley-reminder
  schedule: "0 * * * *"   # 每小時整點，UTC
  buildCommand: cd server && npm install
  startCommand: cd server && node jobs/sendReminders.js
```

**好處**：店家在後台改 `reminderTime` 為 18:00 → 同日下個整點 cron 跑時自動以新時間發送，無需重新部署。

### 7.4 店家 LINE 內一鍵確認預約（依 D4）

**情境**：客戶完成預約後，店家不需打開後台，在 LINE 收到的 Flex Message 直接點按鈕即可確認或取消。

#### 7.4.1 `booking_created_store` Flex Message 範本

```
┌─────────────────────────────────────┐
│  📅 新預約通知                       │
├─────────────────────────────────────┤
│  王小姐                              │
│  電話: 0912-345-678                  │
│  LINE: @wangxiaojie                  │
├─────────────────────────────────────┤
│  項目: 韓式霧眉 (210 分)             │
│  日期: 2026-06-01 (六)               │
│  時間: 10:00 - 13:30                 │
│  備註: 第一次預約                    │
├─────────────────────────────────────┤
│  [✅ 確認預約]   [❌ 取消預約]        │
│       [📋 查看詳情]                  │
└─────────────────────────────────────┘
```

**按鈕 actions**：
- **確認預約** → `postback`，data: `action=booking_confirm&id=123`
- **取消預約** → `postback`，data: `action=booking_cancel&id=123`（前端二次確認）
- **查看詳情** → `uri`，跳轉 `https://lapaisley.com/admin/bookings/123`（需先登入後台）

#### 7.4.2 Webhook postback 處理流程

```
[店家點 ✅ 確認預約]
     │
     ▼
[LINE 平台發送 webhook]
POST /api/line/webhook
{ events: [{ type: 'postback', source: { userId: 'Uxxx' }, postback: { data: 'action=booking_confirm&id=123' } }] }
     │
     ▼
[驗證 x-line-signature HMAC]
     │
     ▼
[檢查 source.userId 是否在 settings.adminLineUserIds 白名單]
     │  否 → 回覆「您沒有權限執行此操作」
     │
     ▼ 是
[parse postback.data]
     │
     ▼
[執行對應動作:
   booking_confirm → 更新 status=confirmed → 觸發 booking_confirmed_customer
   booking_cancel  → 更新 status=cancelled → 觸發 booking_cancelled_customer
]
     │
     ▼
[回覆店家 Flex Message:
   ✅ 已確認預約 - 王小姐 6/1 10:00
   📤 已通知客戶
]
     │
     ▼
[記錄 audit log: who=店家LINE userId, action=booking.confirm.via_line]
```

**白名單機制（D4 + §9 安全）**：
- 只有 `settings.adminLineUserIds` 內的 LINE userId 才能透過 LINE 一鍵操作
- 後台「系統設定」頁可加入/移除（點 LINE 登入連結取得自己的 userId 後填入）
- 預設首次部署時，店家自行加入；未設定時所有 postback 一律拒絕

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
| **Phase 2.5** | 後台代客預約 + 用戶管理 + 預約規則擴充 + 月曆檢視 | 3-4 天 |
| **Phase 3** | LIFF 整合：LIFF SDK、Rich Menu 圖片與設定 | 1-2 天 |
| **Phase 4** | Messaging API：Webhook、機器人指令、Flex Message、自動提醒 Cron | 3-4 天 |
| **Phase 4.5** | 後台訊息模板系統 + 主動推播 + 推播歷史 + 配額監控 | 3-4 天 |
| **Phase 4.7** | 後台 Dashboard 統計 + 稽核日誌 + Rich Menu 上傳 | 2-3 天 |
| **Phase 5** | 整合測試 + 部署 + 網域綁定 + 上線監控 | 2-3 天 |
| **合計** | | **18-26 天** |

---

## 13. 開發順序建議

```
Phase 1 ─▶ 2 ─▶ 2.5 ─▶ 3 ─▶ 4 ─▶ 4.5 ─▶ 4.7 ─▶ 5
   │       │     │      │    │     │       │      │
   ▼       ▼     ▼      ▼    ▼     ▼       ▼      ▼
 基礎    LINE   後台   LIFF  雙向  訊息   後台    上線
 建設    Login  代客    內    Bot   模板   Dashboard
        會員   + 用戶  無縫  Cron  推播   稽核
        系統   管理   預約  提醒  歷史
```

**合併策略（依 D5）**：

- 所有 Phase 都在 **同一條 feature branch** (`claude/analyze-project-content-0kt37`) 上累積 commits
- 每個 Phase 結束時 commit 並推到 origin，方便 Shane 即時審閱進度，但**不**開 PR
- 全部 Phase 完成、整合測試通過後，**一次性開單一 PR 合併到 main**
- PR 內按 Phase 切分 commit history，便於 review

**理由**：避免多次小 PR 來回審查的負擔，整套上線時所有功能彼此搭配完整、無中間半成品狀態。

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

## 16. 後台管理功能完整地圖

> 此章節為 **店家自主性檢核表**：所有前台呈現、預約規則、訊息溝通都應能由後台自行設定，不需開發者介入。

### 16.1 Dashboard（後台首頁）

| 區塊 | 內容 |
|------|------|
| 今日預約 | 列表 + 一鍵狀態更新（待確認 → 已確認 / 已完成 / 已取消） |
| 待辦紅點 | 未確認預約數、待回覆訊息數 |
| 本週/本月統計 | 預約筆數、預估收入、新註冊用戶、各服務佔比 |
| 系統健康 | LINE Webhook 最後事件時間、本月推播配額、DB 連線狀態 |
| 最新消息 | 最後一筆 Webhook event、最近 broadcast 結果 |
| 快速連結 | 跳轉至各管理頁 |

### 16.2 內容管理（前台呈現）

| 區塊 | 可編輯欄位 | 對應前台位置 |
|------|-----------|--------------|
| 個人資訊 | 名稱、Tagline、Bio、頭像、Hero 圖、Email、電話、地址、IG/FB/LINE/Threads | Home Hero / About / Footer |
| 首頁簡介 | `homeIntro`（多行文字） | Home 「關於這裡」 |
| 服務項目 | 名稱、副標、描述、價格、時長、圖、精選、排序 | Services 頁 / Home 精選 |
| 作品集 | 標題、描述、圖、分類、精選、建立日期 | Works 頁 / Home 精選 |
| 最新消息 | 標題、圖片、內文、外連、上架、置頂、發布時間 | Home News / Footer 入口 |
| Footer | 聯絡、社群、版權 | 全站 Footer |
| SEO Meta（v2） | Title、Description、OG Image | `<head>` |
| 主題色彩（v2） | Primary / Accent / Background | 全站 CSS Variables |

### 16.3 預約管理

#### 16.3.1 列表/月曆雙檢視
- **列表檢視**：Filter（狀態、日期、服務、來源、姓名/電話）、批次選取、CSV 匯出
- **月曆檢視**：日曆網格顯示每天預約，點日子展開時段、衝突警告紅標
- **甘特圖檢視**（v2）：時間軸方式顯示一天的所有預約

#### 16.3.2 預約詳情
- 全欄位可編輯（含日期時間，會走 availability 驗證）
- 狀態流轉按鈕（一鍵切換）
- 來源 badge（LINE 客戶 / 電話 / 私訊 / 走入）
- 內部備註（客戶看不到）
- 同電話/userId 客戶歷史展開
- 變更歷史（誰在何時改了什麼，來自 audit log）
- **重新推播按鈕**：選模板 → 重發

#### 16.3.3 後台代客建立預約
- 「+ 新增預約」按鈕
- 流程見 §6.5
- 支援：忽略時段衝突、不通知客戶、連結到已註冊用戶
- 同電話即時搜尋顯示歷史，避免重複建檔

#### 16.3.4 批次操作
- 多選 → 標記完成 / 批次取消 / 批次推送提醒
- 「全選未處理超過 7 天的預約」一鍵清理

### 16.4 可預約時間管理

| 設定 | 描述 | 預設 |
|------|------|------|
| 每週固定時段 | 週日~週六各自的營業時段（可多段） | 已有 |
| 日期 Override | 特定日期改公休或更動時段 | 已有 |
| 公休日批次設定 | 拖曳行事曆勾選多日公休 | 新增 |
| 服務時長 | 每個服務的施作分鐘數 | 已有 |
| 預設時段間隔 | N 分鐘可預約一個（如 30 分） | 已有 |
| 前後緩衝時間 | 每筆預約前後預留 N 分鐘清潔 | 新增 |
| 最早可預約 | 客戶最早可預約幾天後 | 新增（預設 1） |
| 最晚可預約 | 客戶最晚可預約幾小時前 | 新增（預設 24） |
| 取消時限 | 距預約 N 小時內不可取消 | 新增（預設 24） |
| 同用戶限制 | 一週最多 N 筆 | 新增（預設無限） |
| 強制 LINE 登入 | 預約必須先 LINE 登入 | 新增（預設 ON） |

**UI**：
- 行事曆網格直接拖曳設定時段
- 「複製本週設定至下個月」一鍵
- 「設為公休」/「臨時加班」單日操作

### 16.5 用戶管理（LINE 客戶）

- **列表**：頭像、名稱、追蹤狀態、註冊日、預約次數、最後預約、tags
- **Filter**：已追蹤、有電話、有 email、含特定 tag、黑名單
- **Search**：名稱、電話、LINE ID、tag
- **詳情**：
  - 個人資料（可編輯 phone、tags、notes、blocked）
  - 歷史預約清單
  - 推播紀錄
  - **「+ 為此用戶建立預約」**（一鍵跳轉預約建立並預填）
  - **「+ 推訊息」**（單發訊息模態）
- **匯出**：CSV / Excel（行銷用）

### 16.6 LINE 訊息模板

- 模板列表（見 §4.4）
- 每筆可：啟用/停用、編輯內容、即時預覽、切換 text/flex
- 變數插入提示（點擊變數自動插入光標位置）
- Flex Message：提供常用範本（預約卡、優惠卡）
- 「測試發送給自己」按鈕（送到管理員的 LINE）
- 修改後立即生效（不需重新部署）

### 16.7 主動推播 + 推播歷史

#### 推播表單
- 對象：單一用戶 / 標籤群組 / 全體追蹤者
- 訊息類型：文字 / Flex / 圖片
- 立即 / 排程
- 配額警告：本次將消耗 N 則、本月剩餘 M 則
- 二次確認（避免誤送）

#### 推播歷史
- 列表：時間、對象、內容摘要、成功/失敗數、發送者
- 失敗筆可重試
- 排程中可取消

### 16.8 Rich Menu 管理

- 上傳 2500x1686 圖片（提供範本下載）
- 6 區塊 / 4 區塊範本
- 每區塊定義 action：URL / postback / 文字
- 預覽 + 部署到 LINE
- 多版本管理（v2）：A/B test 不同 Rich Menu

### 16.9 自動回覆關鍵字

- 關鍵字陣列 ↔ 回覆內容
- 匹配模式：完全 / 包含 / Regex
- 啟用/停用
- Fallback：無關鍵字命中時的預設回應

### 16.10 系統設定（擴充）

- 業務名稱、營業時間描述（文字）、預約規則文案
- **預約總開關**（緊急停止用）
- **強制 LINE 登入**（如 §4.8 設定）
- LINE 金鑰：Login / Messaging / LIFF ID（含遮罩顯示）
- 推播對象 ID（店家通知用）
- 時區、語系
- 帳號密碼變更
- 多管理員（v2）：邀請、權限分級
- API 健康檢查連結

### 16.11 稽核與安全

- 操作日誌：時間、管理員、動作、目標、IP
- Filter / Search / Export
- 登入記錄
- Webhook event log（讀取 §4.3 的 line_webhook_events）

### 16.12 後台 UI 結構建議

```
左側 Sidebar
├── 📊 Dashboard
├── 📅 預約管理
│   ├── 列表
│   ├── 月曆
│   └── + 新增預約
├── 👥 LINE 客戶
├── 💬 LINE 設定
│   ├── 訊息模板
│   ├── 主動推播
│   ├── 推播歷史
│   ├── Rich Menu
│   ├── 自動回覆
│   └── 推播配額
├── 🌐 前台內容
│   ├── 個人資訊
│   ├── 服務項目
│   ├── 作品集
│   └── 最新消息
├── ⚙ 系統設定
│   ├── 預約時間
│   ├── 預約規則
│   ├── 業務資訊
│   └── 帳號密碼
└── 🔒 稽核日誌
```

---

## 17. 待 Shane 確認事項

> 已決議的事項移至文件頂部「📌 決策紀錄」區塊。以下為仍需釐清的項目。

### 17.1 基礎決策
- [ ] 雲端架構是否採 **Render + Supabase + Cloudflare**？（預設方案）
- [ ] 預計購買的網域名稱（用於 Channel 設定）？
- [ ] 是否需要 email scope（會增加 LINE Login 申請手續）？
- [ ] 月費預算上限（影響方案選擇）？

### 17.2 預約規則細節
- [ ] 取消時限預設 24 小時是否合理？（已預設 24h）
- [ ] 每位用戶每週預約上限要設嗎？（已預設 0 = 不限）
- [ ] 預約前後緩衝時間（清潔/準備）預設幾分鐘？（已預設 0）
- [ ] 提醒前置天數預設 1 天（前一天提醒），是否需要再加 H-3（前 3 小時）？

### 17.3 後台代客預約細節
- [ ] 「忽略時段衝突」按鈕是否需要二次確認（例如 modal 警告）？
- [ ] 「走入客戶」是否要建立 User 紀錄（無 LINE userId 也建立）以便將來追蹤？
- [ ] 後台是否允許 admin 直接指定預約 status（pending / confirmed 二選一），或一律 pending？

### 17.4 訊息與推播細節
- [ ] 客戶可以選擇「不接受提醒」嗎？（個人偏好設定，預設都收到）
- [ ] 推播配額警告閾值（剩 N 則時警告，目前預設 50）
- [ ] 店家 LINE 一鍵確認後，是否同時要在後台介面顯示「來自 LINE 的操作」標記？

### 17.5 上線
- [ ] 上線時想要先邀請少量客戶試用（soft launch）還是直接公開？
- [ ] 是否需要 Google Analytics / GA4 追蹤前台轉換率？

---

**文件版本歷史**

| 版本 | 日期 | 變更 |
|------|------|------|
| v1.0 | 2026-05-11 | 初版 |
| v1.1 | 2026-05-11 | 擴充後台管理功能：代客預約、訊息模板、主動推播、用戶管理、稽核日誌；新增 Phase 2.5 / 4.5 / 4.7 |
| v1.2 | 2026-05-11 | 確認 Shane 5 項決策（D1~D5）；後台代客預約改為「不自動推播，待確認後再推」流程；新增店家 LINE 一鍵確認 Flex Message + postback 流程；提醒時間改為後台可自訂；開發採單一 PR 合併 |
