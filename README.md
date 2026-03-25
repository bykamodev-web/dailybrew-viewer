# Daily Brew Viewer

[Daily Brew](https://github.com/bykamodev-web/dailybrew) が毎日生成する A4 新聞 PDF のオンラインビューワー。

## 概要

Daily Brew は RSS/API + LLM で A4 新聞を毎朝自動生成し、Cloudflare R2 に PDF をアップロードするパイプライン。本リポジトリはその PDF を閲覧するための Web ビューワー。

```
[Daily Brew (Raspi/GitHub Actions)]
  │  毎朝 06:00 JST
  │  generate.py → PDF + メタデータJSON
  ↓
[Cloudflare R2] daily-frontpage バケット (private)
  │  2026-03-25.pdf
  │  2026-03-25.json
  ↓
[Daily Brew Viewer (Cloudflare Pages + Functions)]
  │  S3v4 署名で R2 にアクセス
  ↓
[ブラウザ]  https://daily.bykamo.dev
```

## 機能

- **PDF ビューワー** — PDF.js でキャンバス描画。ダウンロード・印刷不可
- **スワイプ / キーボード** — モバイルはスワイプ、デスクトップは ← → キーで日付移動
- **ズーム** — +/- ボタン (25% ステップ、50%〜400%)
- **ダーク / ライトモード** — ヘッダーのトグルで切替。PDF も反転。localStorage に保存
- **サイドバー** (デスクトップ: 50/50 分割、モバイル: タブ切替)
  - **Sources** — 新聞に掲載した元記事へのリンク
  - **X Trends** — X (Twitter) トレンドの要約 + 検索リンク
  - **Market** — 発行時スナップショット + CoinGecko リアルタイム価格
- **セキュリティ** — R2 非公開、CSP、レート制限、右クリック無効、Ctrl+S/P インターセプト

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| ホスティング | Cloudflare Pages |
| API | Cloudflare Pages Functions (TypeScript) |
| ストレージ | Cloudflare R2 (S3 互換 API) |
| PDF 描画 | PDF.js (ローカルベンダリング) |
| タッチ操作 | Hammer.js |
| フロントエンド | Vanilla JS (フレームワークなし) |
| スタイル | CSS 変数によるテーマ切替 |

## セットアップ

### 前提

- Node.js 18+
- pnpm
- Cloudflare アカウント
- R2 バケット `daily-frontpage` への API トークン

### インストール

```bash
pnpm install
```

### 環境変数

`.dev.vars.example` を `.dev.vars` にコピーして R2 認証情報を設定:

```
R2_ENDPOINT_URL=https://xxxxxxxxxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=daily-frontpage
```

> R2 バケットは Daily Brew 側の Cloudflare アカウントにあるため、R2 バインディングではなく S3 互換 API で接続する。

### ローカル開発

```bash
pnpm dev    # http://localhost:8788
```

## デプロイ

```bash
pnpm deploy
```

本番の R2 認証情報は Cloudflare dashboard > Pages > Settings > Environment variables で設定。

カスタムドメイン (`daily.bykamo.dev`) は Cloudflare Pages の Custom domains で設定。

## API

| エンドポイント | 説明 | キャッシュ |
|---|---|---|
| `GET /api/papers` | 日付リスト (新しい順) | 1時間 |
| `GET /api/papers/:date` | PDF ストリーミング | 7日 (immutable) |
| `GET /api/papers/:date/meta` | メタデータ JSON | 7日 (immutable) |

## R2 データ形式

Daily Brew の `generate.py` が毎日アップロード:

| ファイル | 内容 |
|---------|------|
| `YYYY-MM-DD.pdf` | A4 新聞 PDF |
| `YYYY-MM-DD.json` | メタデータ (sources, x_trends, market) |

### メタデータ JSON 構造

```json
{
  "date": "2026-03-25",
  "language": "ja",
  "sources": [
    {
      "headline": "記事ヘッドライン",
      "source_name": "CoinDesk",
      "url": "https://...",
      "category": "web3"
    }
  ],
  "x_trends": [
    {
      "headline": "トレンド見出し",
      "summary": "要約テキスト",
      "source": "@username",
      "keyword": "English Keyword"
    }
  ],
  "market": [
    {
      "display": "BTC",
      "price": "$71,170",
      "change_str": "+0.5%",
      "is_up": true
    }
  ]
}
```

## ファイル構成

```
viewer/
├── wrangler.toml              # Cloudflare Pages 設定
├── package.json
├── tsconfig.json
├── public/                    # 静的アセット
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── app.js             # メイン (テーマ・タブ・ズーム・ナビゲーション)
│   │   ├── api.js             # API クライアント
│   │   ├── viewer.js          # PDF.js 描画・ズーム制御
│   │   ├── navigation.js      # スワイプ・キーボード・ハッシュルーティング
│   │   └── sidebar.js         # Sources・X Trends・Market
│   └── vendor/                # PDF.js, Hammer.js (ローカルベンダリング)
├── functions/                 # Cloudflare Pages Functions
│   ├── _middleware.ts         # セキュリティヘッダー・レート制限
│   ├── lib/s3.ts              # S3v4 署名 (Web Crypto API)
│   └── api/papers/
│       ├── index.ts           # 日付リスト
│       └── [date]/
│           ├── index.ts       # PDF ストリーミング
│           └── meta.ts        # メタデータ
└── types/env.d.ts
```

## 関連

- [Daily Brew](https://github.com/bykamodev-web/dailybrew) — PDF/JSON 生成パイプライン (Python)
