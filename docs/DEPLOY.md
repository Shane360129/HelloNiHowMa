# La Paisley 完整上線部署指南

> 從零到正式上線的逐步操作手冊。預估首次部署時間 **2-3 小時**（不含等 DNS 生效）。

---

## 📋 目錄

- [0. 部署架構總覽](#0-部署架構總覽)
- [1. 前置作業（帳號註冊）](#1-前置作業帳號註冊)
- [2. LINE Developers Console 設定](#2-line-developers-console-設定)
- [3. 購買網域 + Cloudflare DNS](#3-購買網域--cloudflare-dns)
- [4. Supabase 建立資料庫](#4-supabase-建立資料庫)
- [5. Render 部署 Web Service + Cron](#5-render-部署-web-service--cron)
- [6. 綁定自有網域 + SSL](#6-綁定自有網域--ssl)
- [7. 回 LINE Console 更新所有 URL](#7-回-line-console-更新所有-url)
- [8. 系統初始化（首次登入後台）](#8-系統初始化首次登入後台)
- [9. 上線前驗證 Checklist](#9-上線前驗證-checklist)
- [10. Soft Launch + 監控](#10-soft-launch--監控)
- [11. 故障排除](#11-故障排除)
- [12. 後續維運](#12-後續維運)

---

## 0. 部署架構總覽

```
            [客戶瀏覽器]                 [LINE App]
                │                          │
                ▼                          ▼
        ┌─────────────────────────────────────┐
        │  Cloudflare（DNS + WAF + SSL + CDN）│
        └──────────────┬──────────────────────┘
                       │
                       ▼
        ┌─────────────────────────────────────┐
        │  Render Web Service                  │
        │   - Node 22 + Express                │
        │   - 已 build 的 React SPA            │
        │   - healthCheckPath: /api/health     │
        └──────┬──────────────────────────────┘
               │
       ┌───────┴────────┬────────────────┐
       ▼                ▼                ▼
┌─────────────┐ ┌───────────────┐ ┌──────────────┐
│  Supabase   │ │  Render Cron  │ │ LINE Platform│
│  Postgres   │ │  (整點觸發)   │ │  · Messaging │
│             │ │  提醒推播     │ │  · Login     │
│             │ │               │ │  · LIFF      │
└─────────────┘ └───────────────┘ └──────────────┘
```

---

## 1. 前置作業（帳號註冊）

以下帳號**全部需要本人 email 註冊**，建議用同一個信箱方便管理：

| 服務 | 用途 | 是否需付費 | 預估時間 |
|------|------|----------|---------|
| GitHub | 程式碼託管 | 免費 | 5 分 |
| LINE Developers | LINE 各 Channel | 免費 | 5 分 |
| **網域註冊商** | 自有網域（如 `lapaisley.com`） | $10-15 USD/年 | 10 分 |
| Cloudflare | DNS + CDN + SSL | 免費起 | 5 分 |
| Supabase | PostgreSQL 託管 | 免費起 / Pro $25/月 | 5 分 |
| Render | Web + Cron 託管 | $7-25/月 | 5 分 |

**月度成本預估**：
- 最低：$7/月（Render Starter + Supabase Free）
- 推薦：~$51/月（Render Standard $25 + Supabase Pro $25 + Cloudflare Free + 網域 $1/月）

---

## 2. LINE Developers Console 設定

> ⚠️ **這一步最重要也最容易卡住**。請依序完成所有 Channel + LIFF App。

### 2.1 建立 / 確認 Provider

1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 若尚無 Provider，點「Create」建立一個 Provider，名稱填 `La Paisley`
3. 進入該 Provider

### 2.2 建立 Messaging API Channel（綁定官方帳號）

1. 在 Provider 頁面點「Create a new channel」→「Messaging API」
2. 填寫：
   - **App name**：`La Paisley 預約系統`
   - **App description**：`La Paisley 霧眉美業預約通知`
   - **Category** / **Subcategory**：依官方帳號分類填
   - **Email**：你的聯絡 email
3. 同意條款後建立
4. 建立完成後到該 Channel 的：
   - **Basic settings** 分頁 → 記下 **Channel secret**
   - **Messaging API** 分頁 → **Issue a Channel access token (long-lived)** → 記下 token
5. 把現有 LINE 官方帳號連結過來：
   - **Messaging API** 分頁 → **LINE Official Account features** → 點「Open Manager」
   - 跳轉到 [OA Manager](https://manager.line.biz/)，選你的官方帳號
   - 切換到「設定 → 回應設定」：
     - **聊天**：✅ 開啟
     - **Webhook**：✅ 開啟（URL 之後填）
     - **自動回應訊息**：❌ 關閉（會跟我們的 webhook 衝突）
     - **加入好友的歡迎訊息**：可選（我們的 webhook 已有 `oa_welcome` 模板）

### 2.3 取得官方帳號自己的 userId（用於店家通知）

1. 在 Messaging API Channel → **Messaging API** 分頁 → 用手機 LINE 加官方帳號為好友
2. 在 LINE 內傳任意訊息給官方帳號
3. **方法 A**（推薦）：在 Channel 的 **Webhook 設定** 把 Webhook URL 暫時填一個 [webhook.site](https://webhook.site) 的隨機 URL，再傳一次訊息，從 webhook payload 看 `events[0].source.userId`，這就是你的 userId（`U` 開頭 33 字元）
4. **方法 B**：之後系統部署完成後，在客戶端用 LINE 登入，到 `/api/auth/me` 看自己的 `lineUserId`

把這個 userId 記下來，環境變數 `LINE_TARGET_ID` 要填這個。

### 2.4 建立 LINE Login Channel（同一 Provider）

1. 在 Provider 頁面再點「Create a new channel」→「LINE Login」
2. 填寫：
   - **App name**：`La Paisley 會員系統`
   - **App description**：`客戶登入預約`
   - **App types**：✅ Web app、✅ Native app（給 LIFF 用）
3. 建立後到該 Channel 的 **Basic settings**：
   - 記下 **Channel ID** + **Channel secret**
4. 切到 **LINE Login** 分頁：
   - **Callback URL**：暫填 `https://你的網域/api/auth/line/callback`（網域之後再改，先填臨時的）
   - **Scopes**：✅ `profile`、✅ `openid`
   - **Bot link** (在 LIFF 設定內)：之後選 Aggressive

### 2.5 建立 LIFF App（在 LINE Login Channel 底下）

1. 進入 LINE Login Channel → **LIFF** 分頁 → **Add**
2. 填寫：
   - **LIFF app name**：`La Paisley 預約`
   - **Size**：`Full`
   - **Endpoint URL**：暫填 `https://你的網域/booking?liff=1`
   - **Scope**：✅ `profile`、✅ `openid`
   - **Bot link feature**：`On (Aggressive)`（自動讓 LIFF 使用者 follow OA）
3. 建立後記下 **LIFF ID**（格式 `2001234567-AbCdEfGh`）

### 2.6 環境變數對照表

完成以上後，你應該有以下 8 個值：

| 環境變數 | 取自 |
|---------|------|
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | Messaging API Channel → Issue Token |
| `LINE_MESSAGING_CHANNEL_SECRET` | Messaging API Channel → Basic settings → Channel secret |
| `LINE_TARGET_ID` | 你（店家）的 LINE userId |
| `LINE_LOGIN_CHANNEL_ID` | LINE Login Channel → Basic settings → Channel ID |
| `LINE_LOGIN_CHANNEL_SECRET` | LINE Login Channel → Basic settings → Channel secret |
| `LINE_LOGIN_CALLBACK_URL` | `https://你的網域/api/auth/line/callback` |
| `LINE_LIFF_ID` | LIFF App → LIFF ID |

---

## 3. 購買網域 + Cloudflare DNS

### 3.1 購買網域

推薦 **Cloudflare Registrar**（買價即賣價，內含 WHOIS 隱私）。
備選：Namecheap、Google Domains、GoDaddy。

範例：`lapaisley.com`（每年 $10 左右）

### 3.2 把網域 DNS 指向 Cloudflare

1. 註冊 [Cloudflare 帳號](https://dash.cloudflare.com/sign-up)
2. 點「Add a Site」輸入你的網域
3. 選免費方案
4. Cloudflare 會給你 2 組 nameservers，回到網域註冊商把 nameservers 改為這 2 組
5. 等 5-30 分鐘 DNS 生效（Cloudflare 會 email 通知）

> 用 Cloudflare Registrar 買的網域**自動跳過這步**。

### 3.3 Cloudflare SSL 設定

1. Cloudflare Dashboard → 你的網域 → **SSL/TLS** 分頁
2. **Encryption mode**：設為 **Full (strict)**
3. **Edge Certificates** → ✅ Always Use HTTPS
4. **Edge Certificates** → ✅ Automatic HTTPS Rewrites

---

## 4. Supabase 建立資料庫

1. 註冊 [Supabase 帳號](https://supabase.com)
2. 「New Project」：
   - **Name**：`la-paisley`
   - **Database Password**：生成一組強密碼，**記下來**
   - **Region**：選 `Northeast Asia (Tokyo)` 或 `Southeast Asia (Singapore)`
   - **Plan**：Free（之後可升 Pro）
3. 等 1-2 分鐘建立完成
4. 取得連線字串：
   - 左側 **Project Settings** → **Database**
   - 找到 **Connection string** → **URI** 格式
   - 複製類似 `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`
   - **把 `[YOUR-PASSWORD]` 換成你剛才設的密碼**，這就是 `DATABASE_URL`

> ℹ️ Supabase Free 方案有 7 天無活動會暫停限制；正式上線建議升 Pro（$25/月，含 PITR 備份）。

---

## 5. Render 部署 Web Service + Cron

### 5.1 把專案連到 Render

1. 註冊 [Render 帳號](https://render.com)（用 GitHub 登入最方便）
2. Dashboard → **New** → **Blueprint**
3. 點「Connect a repository」授權 GitHub，選 `Shane360129/HelloNiHowMa`
4. 選擇分支（main 或目標分支）
5. Render 會讀取專案根目錄的 `render.yaml`，顯示即將建立的服務：
   - `la-paisley`（Web Service）
   - `la-paisley-reminders`（Cron Job）

### 5.2 設定環境變數

Render 會列出所有 `sync: false` 的環境變數要你填。把第 2.6 表格的值填入，加上：

| 環境變數 | 值 |
|---------|----|
| `DATABASE_URL` | Supabase 連線字串（含密碼） |
| `ALLOWED_ORIGINS` | `https://你的網域,https://www.你的網域`（用逗號分隔） |
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | 步驟 2.2 |
| `LINE_MESSAGING_CHANNEL_SECRET` | 步驟 2.2 |
| `LINE_TARGET_ID` | 步驟 2.3 |
| `LINE_LOGIN_CHANNEL_ID` | 步驟 2.4 |
| `LINE_LOGIN_CHANNEL_SECRET` | 步驟 2.4 |
| `LINE_LOGIN_CALLBACK_URL` | `https://你的網域/api/auth/line/callback` |
| `LINE_LIFF_ID` | 步驟 2.5 |

> `JWT_SECRET` 設為 `generateValue: true`，Render 會自動產生一組安全亂數。

### 5.3 觸發首次部署

點「Apply」→ Render 開始 build。首次 build 約 5-10 分鐘：
1. `cd client && npm install --include=dev && npm run build`
2. `cd ../server && npm install`
3. `npm start`

部署完成後，Render 會給一個臨時網址，類似 `https://la-paisley.onrender.com`。

打開 `https://la-paisley.onrender.com/api/health` 應該回傳：
```json
{
  "status": "ok",
  "uptime": 12.34,
  "db": true,
  "templates": 7,
  ...
}
```

### 5.4 確認 Cron Job 已建立

Render Dashboard → 應該看到兩個服務：
- `la-paisley`（Web Service，狀態：Live）
- `la-paisley-reminders`（Cron Job，下次執行時間：下一個整點）

---

## 6. 綁定自有網域 + SSL

### 6.1 在 Render 加入自訂網域

1. 進入 `la-paisley` 服務 → **Settings** → **Custom Domains**
2. 點「Add Custom Domain」輸入 `lapaisley.com` 和 `www.lapaisley.com`
3. Render 會給你兩條 DNS 紀錄，類似：
   ```
   lapaisley.com         CNAME  la-paisley.onrender.com
   www.lapaisley.com     CNAME  la-paisley.onrender.com
   ```

### 6.2 在 Cloudflare 加 DNS 記錄

1. Cloudflare Dashboard → 你的網域 → **DNS** → **Records**
2. 加兩筆 CNAME：
   ```
   Type: CNAME   Name: @     Target: la-paisley.onrender.com   Proxy: 🟠 Proxied
   Type: CNAME   Name: www   Target: la-paisley.onrender.com   Proxy: 🟠 Proxied
   ```
3. 等 5-15 分鐘 DNS 生效
4. 回 Render，網域狀態應變成 **Verified** ✅
5. SSL 由 Cloudflare 處理；如果 Render 報「SSL 待簽發」可忽略（Cloudflare 已負責）

### 6.3 驗證

打開 `https://lapaisley.com/api/health` 應該回 200。

---

## 7. 回 LINE Console 更新所有 URL

> ⚠️ **這一步很容易忘記**。網域生效後**一定要**回 LINE Console 更新。

### 7.1 Messaging API Webhook

1. Messaging API Channel → **Messaging API** 分頁
2. **Webhook URL**：填 `https://lapaisley.com/api/line/webhook`
3. 點「Verify」應該顯示成功
4. ✅ Use webhook
5. ❌ Auto-reply messages（在 OA Manager 設定）

### 7.2 LINE Login Callback URL

1. LINE Login Channel → **LINE Login** 分頁
2. **Callback URL**：改為 `https://lapaisley.com/api/auth/line/callback`
3. 儲存

### 7.3 LIFF Endpoint URL

1. LINE Login Channel → **LIFF** 分頁 → 點該 LIFF App 進入編輯
2. **Endpoint URL**：改為 `https://lapaisley.com/booking?liff=1`
3. 儲存

### 7.4 同步更新 Render 環境變數

回 Render Dashboard → la-paisley → **Environment**：
- `LINE_LOGIN_CALLBACK_URL` 確認是 `https://lapaisley.com/api/auth/line/callback`
- `ALLOWED_ORIGINS` 確認包含你的網域

儲存後 Render 會自動重啟。

---

## 8. 系統初始化（首次登入後台）

### 8.1 登入後台

1. 打開 `https://lapaisley.com/admin`
2. 帳號 `admin` 密碼 `admin123`

### 8.2 **立即修改密碼** ⚠️

到「系統設定 → 變更管理員密碼」改為強密碼。

### 8.3 確認 LINE 設定已注入

「系統設定」頁面下方 LINE 區塊應該顯示已有 Channel Access Token 等值（從環境變數注入）。
你也可以在這裡額外覆寫某些值（DB 值會覆蓋 env，請小心）。

### 8.4 設定 adminLineUserIds 白名單（D4 一鍵確認預約）

「系統設定 → 店家 LINE 內一鍵確認預約」加入你（店家）的 LINE userId。
這樣你在 LINE 收到新預約 Flex Message 時，可以直接按「✅ 確認預約」按鈕。

### 8.5 設定店家資訊

到「個人資訊」填入：
- 店家名稱、Bio、Tagline
- 頭像、Hero 圖
- 聯絡 email、電話、地址
- 社群連結

### 8.6 設定預約規則

「系統設定 → 預約規則」：
- 預設預約時長：依服務調整（霧眉建議 180-210 分）
- 時段間隔、緩衝、最早/最晚預約、取消時限
- ✅ 強制 LINE 登入（D1 預設 ON）

「系統設定 → 預約時段設定」：
- 設定週一到週日的營業時段

### 8.7 設定提醒

「系統設定 → 提醒設定」：
- ✅ 啟用自動提醒
- 提醒時間（預設 10:00，可改）
- 提前天數（預設 1）

### 8.8 LINE 訊息模板檢查

「訊息模板」頁面確認 7 個模板都已 seed：
- booking_created_customer ✅
- booking_created_store ✅ (Flex)
- booking_confirmed_customer ✅
- booking_cancelled_customer ✅
- booking_completed_customer ⬜（預設停用，可開）
- booking_reminder ✅
- oa_welcome ✅

點任一模板「編輯」→ 「發送測試訊息給店家 LINE」→ 應該收到測試訊息。

### 8.9 Rich Menu（建議步驟，可後做）

最簡單方式：到 [LINE OA Manager](https://manager.line.biz/) → 主頁 → **聊天室** → **圖文選單** 建立。

建議 6 宮格：

| 立即預約 (URL) | 我的預約 (URL) |
|--------------|---------------|
| 服務項目 (URL) | 作品集 (URL) |
| 營業時間 (postback) | 聯絡我們 (postback) |

「立即預約」URL 填 `https://liff.line.me/你的LIFF_ID`，這樣會在 LINE 內直接開預約頁。

設定完後到後台「Rich Menu」確認可看見並設為預設。

---

## 9. 上線前驗證 Checklist

照順序測試，確保所有功能正常：

### 9.1 基本功能
- [ ] `https://lapaisley.com/` 首頁可正常開啟
- [ ] `/api/health` 回 200 且 `db: true, templates >= 7`
- [ ] 服務項目頁、作品集頁可正常顯示
- [ ] 後台可登入

### 9.2 客戶 LINE 登入（瀏覽器）
- [ ] 在電腦瀏覽器開 `/booking`，未登入時顯示「請先以 LINE 登入」
- [ ] 點 LINE 登入按鈕 → 跳到 LINE 授權頁 → 同意後跳回 → 自動帶入姓名

### 9.3 客戶預約流程（瀏覽器）
- [ ] 選服務、選時段、填電話、送出
- [ ] 收到「預約申請已送出」訊息
- [ ] 店家 LINE 收到 **Flex Message** 含 [確認][取消] 按鈕
- [ ] 客戶 LINE 收到 `booking_created_customer` 文字訊息

### 9.4 店家一鍵確認
- [ ] 店家在 LINE 點「✅ 確認預約」
- [ ] 預約狀態自動變成 confirmed
- [ ] 客戶 LINE 收到 `booking_confirmed_customer` 訊息
- [ ] 後台「預約管理」可看到狀態已更新
- [ ] 後台「稽核日誌」可看到 `booking.confirm.via_line` 紀錄

### 9.5 我的預約
- [ ] 客戶開 `/me/bookings` 看到自己的預約
- [ ] 取消預約 → 客戶收到 `booking_cancelled_customer`
- [ ] 切換「接收提醒」開關 → `/api/auth/me` 回傳 `reminderOptIn` 已變更

### 9.6 後台代客建立
- [ ] 後台「預約管理」點 `+ 新增預約`
- [ ] 填入新電話 → 應自動建立 User
- [ ] 填入既有電話 → 應顯示「找到既有客戶」提示
- [ ] 預設 status=pending → 客戶不會收到通知
- [ ] 改為 confirmed → 客戶收到 `booking_confirmed_customer`

### 9.7 LIFF 流程（手機）
- [ ] 在手機 LINE 內貼上 `https://liff.line.me/你的LIFF_ID` 訊息點進入
- [ ] 應該在 LINE App 內開啟 `/booking?liff=1`
- [ ] 自動登入（不再要求點 LINE 登入按鈕）
- [ ] 預約頁面標題下方出現「🟢 您正在 LINE 內預約」綠色 pill
- [ ] 完成預約應正常運作

### 9.8 機器人指令
- [ ] 在 LINE 傳「預約」→ 收到 LIFF 連結
- [ ] 傳「查預約」→ 收到未完成預約列表
- [ ] 傳「營業時間」→ 收到 settings 內容
- [ ] 傳「菜單」→ 收到服務項目列表

### 9.9 提醒 Cron
- [ ] Render Dashboard → la-paisley-reminders → **Logs** 可看到整點觸發紀錄
- [ ] 手動觸發測試：在 Render Cron 頁點「Trigger Run」應有對應 log
- [ ] 預約一筆「明天」的時段，設定 `reminderTime` 為下個整點 → 整點後該客戶應收到 `booking_reminder`

### 9.10 推播功能
- [ ] 後台「主動推播」配額橫幅顯示正確
- [ ] 發送一則測試到「全體追蹤者」→ 收到訊息且歷史紀錄 successCount > 0

### 9.11 安全測試
- [ ] 嘗試直接 `POST /api/bookings` 不帶 token → 401 `LINE_LOGIN_REQUIRED`
- [ ] 嘗試以客戶 JWT 打 admin endpoint → 401（雙 audience 隔離）
- [ ] 嘗試以非 adminLineUserIds 的 LINE 帳號按 Flex 確認按鈕 → 收到「您沒有權限」回覆

---

## 10. Soft Launch + 監控

### 10.1 邀請少量客戶試用

1. 在 LINE 官方帳號發布貼文，附上 LIFF 連結
2. 私訊邀請 10-20 位常客優先試用 1-2 週
3. 收集回饋（特別是預約流程、訊息收到時機）

### 10.2 監控指標

每日檢查 Render Dashboard：
- **Web 服務 CPU / Memory**：應該都在 50% 以下
- **Logs**：搜尋 `error` 看是否有異常
- **Cron 執行狀況**：每整點應該有 log

每日檢查後台：
- **總覽**：今日預約 / 待確認紅點
- **LINE 推播配額**：剩餘量
- **稽核日誌**：是否有異常操作

### 10.3 收集 KPI（如有加 GA4）

- 預約轉換率：`view_booking_page` → `submit_booking`
- LINE 登入率：`start_line_login` → `line_login_complete`
- LIFF 流量比例：`liff_open` vs 一般 booking

---

## 11. 故障排除

### 11.1 部署後 500 / 連不上

→ Render Logs 看啟動訊息。啟動時會印出：
```
────────────────────────────────
  La Paisley starting…
  Env vars:
   ✓  DATABASE_URL
   ✓  JWT_SECRET
   ...
────────────────────────────────
```
- 若某 env var 標 `✗ MISSING`：回 Render Environment 補上重啟
- 若 `DATABASE_URL` 連不上：檢查 Supabase 是否暫停（Free 方案 7 天無活動會暫停）

### 11.2 客戶 LINE 登入跳轉後出現 400

→ 通常是 callback URL 不一致。檢查：
- LINE Login Channel 的 Callback URL
- Render env `LINE_LOGIN_CALLBACK_URL`
- 兩者**必須完全一致**（包含末尾無 `/`）

### 11.3 客戶預約後店家沒收到通知

→ 檢查順序：
1. `/api/admin/dashboard/stats` → `lineHealth.lastWebhookAt` 是否有更新
2. 「主動推播」配額是否還有
3. 「系統設定」確認 `LINE_TARGET_ID` 已填
4. 客戶必須是 `customer_self`（自助預約）才會推店家；後台代客建立不會推

### 11.4 一鍵確認按鈕無反應 / 回「沒有權限」

→ 確認「系統設定 → 店家 LINE 內一鍵確認預約」白名單內**有你按按鈕的那個 LINE 帳號的 userId**。

### 11.5 Webhook 簽章驗證失敗

→ Render Logs 會出現 `[webhook] invalid signature`。
- 檢查 `LINE_MESSAGING_CHANNEL_SECRET` 是否與 Messaging API Channel 的 secret 一致
- 確認 Channel 「Use webhook」是 ON

### 11.6 LIFF 在 LINE 內白屏

→ 通常是：
- LIFF Endpoint URL 不是 https 或不可訪問
- LIFF ID 與環境變數不符
- 在 LIFF Inspector ([使用方法](https://developers.line.biz/en/docs/liff/use-liff-inspector/)) 看 console error

### 11.7 提醒 Cron 沒發

→ 檢查：
- Render Cron 服務狀態（應該每整點都有 log）
- `settings.reminderTime` 跟現在時間的「整點」是否對得上
- `settings.reminderEnabled` 是否為 true
- 預約是否符合：明天的日期、status pending/confirmed、reminderSentAt is null、客戶 reminderOptIn=true、有 lineUserId

---

## 12. 後續維運

### 12.1 升級 / 改程式

1. 在 GitHub PR 改完合併到主分支
2. Render 自動偵測到 push，重新 build + deploy
3. 整段過程 ~5 分鐘，期間 Render 維持舊版本服務不中斷

### 12.2 資料備份

- Supabase Pro 自動每日備份 + Point-in-Time Recovery
- 也可手動：Supabase Dashboard → **Database** → **Backups** → Download
- 重要時間點建議手動加 backup label

### 12.3 LINE 推播配額用完怎麼辦

LINE 免費方案每月 500 則訊息（不含 broadcast 給全體 follower，那是免費）。
- **暫時方案**：當月只用 broadcast 給全體
- **長期方案**：升級 LINE Messaging API 付費方案

後台 Dashboard 會顯示剩餘量，剩 < 50 時警告。

### 12.4 換網域

1. 買新網域、DNS 指 Cloudflare
2. Render → Custom Domains 加新網域，先別移除舊的
3. Cloudflare 加 CNAME
4. **依本指南第 7 章更新 LINE Console URLs**（callback、webhook、LIFF endpoint）
5. Render env 更新 `LINE_LOGIN_CALLBACK_URL` 和 `ALLOWED_ORIGINS`
6. 等 1-2 週確認流量都轉過去後，再移除舊網域

### 12.5 多管理員

目前僅單一 admin 帳號。如需多管理員，需要新增功能（spec §15 規劃 v2）。

---

## 🎉 完成！

如有問題，先看 [docs/cloud-line-integration.md](cloud-line-integration.md) 規格書，再參考此指南的故障排除章節。
