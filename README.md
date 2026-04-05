# Sales Reminder Desk

這個版本已調整為：

- 外網使用
- Firebase Email/Password 登入
- 管理者可匯入 Excel
- 一般員工只能查詢與查看提醒
- 後端使用 Node.js

## 功能角色

- `admin`
  - 可登入
  - 可匯入 Excel / CSV
  - 匯入後會覆蓋目前資料集
- `viewer`
  - 可登入
  - 只能查詢資料與查看提醒
  - 不能匯入

管理者身份目前由 `.env` 的 `ADMIN_EMAILS` 控制。

## 專案結構

- `server.js`
  - Express 後端
- `src/firebase.js`
  - Firebase Admin 驗證
- `src/storage.js`
  - 目前資料集儲存
- `src/transform.js`
  - Excel 欄位轉換
- `public/`
  - 前端頁面

## Firebase 設定

### 1. 建立 Firebase 專案

到 Firebase Console 建立一個新專案。

### 2. 開啟 Authentication

- 進入 `Authentication`
- 啟用 `Email/Password`

### 3. 建立 Web App

- 在 Firebase 專案中新增 Web App
- 取得前端設定值

### 4. 建立 Service Account

- 進入 `Project settings`
- `Service accounts`
- 產生新的私鑰
- 把內容填入 `.env`

## 環境變數

把 `.env.example` 複製成 `.env`，並填入：

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_APP_ID`
- `ADMIN_EMAILS`

`ADMIN_EMAILS` 可放多個，用逗號分隔。

範例：

```env
ADMIN_EMAILS=admin1@company.com,admin2@company.com
```

## 管理員新增帳號

你可以直接在 Firebase Console 的 Authentication 裡建立員工帳號：

- 管理者帳號：email 要出現在 `ADMIN_EMAILS`
- 一般員工帳號：email 不要出現在 `ADMIN_EMAILS`

## 啟動步驟

### 1. 安裝套件

```bash
npm install
```

### 2. 啟動開發環境

```bash
npm run dev
```

### 3. 正式啟動

```bash
npm start
```

## 建議部署方式

外網使用時，建議以下其中一種：

- Railway
- Render
- VPS + PM2 + Nginx
- Windows Server + NSSM / PM2

如果你要讓公司外網穩定使用，我比較建議：

1. Node.js 部署在 VPS 或 Render
2. HTTPS 網域
3. Firebase Auth 管登入
4. 只有管理者帳號能匯入

## Render 部署建議

目前這個專案已經補上：

- `render.yaml`
- `.node-version`
- `/healthz`

你可以直接部署到 Render：

1. 把專案推到 GitHub
2. 到 Render 建立新的 `Blueprint` 或 `Web Service`
3. 指向這個 repo
4. 把 `.env` 內容填到 Render 的 Environment Variables
5. 部署完成後，會拿到一個 `onrender.com` 網址

### Render 一定要補的環境變數

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_APP_ID`
- `ADMIN_EMAILS`

### Firebase 另外要做的事

部署到 Render 後，要去 Firebase Authentication 把你的外網網域加入 `Authorized domains`。

例如你的網址如果是：

- `sales-reminder-desk.onrender.com`

就要把：

- `sales-reminder-desk.onrender.com`

加到 Firebase Authentication 的授權網域。

## 目前資料儲存方式

目前匯入資料會寫到：

- `data/current-dataset.json`

這代表：

- 管理者每次匯入都會覆蓋目前資料
- 所有員工登入後看到的是同一份最新資料

如果你後續要更正式：

- 可以改成 SQLite / PostgreSQL / MySQL
- 保留每次匯入歷史版本
- 增加操作記錄

## 建議下一步

1. 先完成 Firebase 專案建立
2. 填好 `.env`
3. 安裝套件並本機測試
4. 建立 1 個管理者帳號與 1 個員工帳號
5. 測試登入、匯入、查詢、提醒
6. 再部署到外網主機
