# 誰の曲？匿名セトリ推理ゲーム

匿名で提出された曲名から「誰が選んだか」を当てる、3〜6人向けのオンラインパーティゲームです。  
フロントエンドは React + Vite、共有状態は Firebase Authentication と Firestore、配信は Cloudflare Pages を前提にしています。

## 現在の優先事項

- `npm run build` が通ること
- Cloudflare Pages でトップページが表示されること
- Firebase 環境変数不足で白紙にならないこと
- その後にルーム作成から対戦フローを順に確認すること

## 技術スタック

- React 19
- Vite 7
- TypeScript
- Tailwind CSS 4
- Firebase Authentication (Anonymous)
- Cloud Firestore
- Cloudflare Pages

## ローカル起動

1. Node.js 22 を使います。`.nvmrc` を置いているので `nvm use` を使えます。
2. 依存関係をインストールします。

```bash
npm install
```

3. `.env.example` をコピーして `.env.local` を作成し、Firebase の値を入力します。

```bash
copy .env.example .env.local
```

4. 開発サーバーを起動します。

```bash
npm run dev
```

5. Cloudflare Pages 相当の `staging` モードを使いたい場合は次を使います。

```bash
npm run dev:staging
```

## 必要な環境変数

最低限必要なのは次です。

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

任意項目は次です。

- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_APP_ENV`

環境変数が不足している場合でも、アプリは白紙ではなく設定エラー画面を表示します。

## Firebase 側の前提設定

1. Firebase Console で Web App を作成する
2. Authentication で Anonymous を有効化する
3. Cloud Firestore を有効化する
4. [`firestore.rules`](C:/Users/tomoc/Projects/誰の曲？匿名セトリ推理ゲーム/firestore.rules) を Firebase に反映する

## Cloudflare Pages 設定

まずは 1 環境に寄せて単純化します。`build:staging` ではなく `build` を使う前提でよいです。

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: 空欄
- Node.js version: `22`

Cloudflare Pages の Environment Variables に、`.env.example` と同じ `VITE_...` 変数を登録してください。

### 補足

- `npm run build:staging` は残していますが、現時点の Pages 復旧では必須ではありません。
- Pages 側の Build command が `npm run build:staging` になっていると、古いコミットを参照した場合に `Missing script: "build:staging"` になる可能性があります。まず `npm run build` に統一してください。

## 利用可能なスクリプト

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run dev:staging`
- `npm run build:staging`

## 現状の既知課題

- 一部画面文言に文字化けが残っています
- オンライン対戦フロー全体は未監査です
- Cloudflare Pages 復旧後に、ルーム作成 → 参加 → 提出 → 推理 → 結果 を順に確認する必要があります
