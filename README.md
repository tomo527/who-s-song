# 誰の曲？匿名セトリ推理ゲーム

匿名で提出された曲名から「誰が選んだか」を当てるオンラインパーティゲームです。  
フロントエンドは React + Vite、共有状態は Firebase Authentication と Firestore、配信は Cloudflare Pages を前提にしています。

## 今回の到達目標

- `npm run build` が通る
- Cloudflare Pages でトップページが表示される
- Firebase 環境変数不足でも白紙にならず、設定エラー画面が表示される

## 技術スタック

- React 19
- Vite 7
- TypeScript
- Tailwind CSS 4
- Firebase Authentication (Anonymous)
- Cloud Firestore
- Cloudflare Pages

## ローカル起動

1. Node.js 22 を使います。
2. 依存関係をインストールします。

```bash
npm install
```

3. `.env.example` をコピーして `.env.local` を作成し、Firebase の値を設定します。

```bash
copy .env.example .env.local
```

4. 開発サーバーを起動します。

```bash
npm run dev
```

## 利用可能なスクリプト

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run dev:staging`
- `npm run build:staging`

`build:staging` は Vite の `staging` モードでビルドします。Cloudflare Pages の復旧では `npm run build` を基本にしてください。

## 必須の環境変数

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

任意:

- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_APP_ENV`

必須値が不足している場合、アプリは Firebase を初期化せず、ホーム画面またはエラー画面で不足項目を表示します。

## Firebase 側の前提

1. Firebase Console で Web App を作成する
2. Authentication で Anonymous を有効化する
3. Cloud Firestore を有効化する
4. `firestore.rules` を Firebase に反映する

## Cloudflare Pages 設定

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `22`

Cloudflare Pages の Environment Variables には、`.env.example` と同じ `VITE_FIREBASE_*` を登録してください。

## 補足

- まずは 1 環境での表示復旧を優先しています
- オンライン対戦フロー全体は次段階で確認します
- 画面表示上の主要な文字化けは今回の復旧対象で修正しています
