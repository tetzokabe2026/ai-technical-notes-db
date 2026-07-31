# AI Technical Notes DB

Next.js + Supabase で動く技術メモ管理アプリです。階層カテゴリ、認証、画像付きメモ、任意の評価 API 連携に対応しています。

## Features

- 技術メモの作成・編集・検索
- 階層カテゴリと AI による分類支援（OpenAI、任意）
- メール / パスワード認証と管理者承認フロー
- Supabase Storage への画像アップロード
- メモ作成時の評価 API 連携（`NOTE_RATING_API_URL`、任意）

## Stack

- Next.js (App Router) / TypeScript / Tailwind CSS
- Supabase (Auth, Postgres, Storage)
- Google Cloud Run（本番デプロイ例）

## Getting Started

```bash
cp .env.example .env.local
# .env.local に Supabase などの値を設定

npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開きます。

管理者ユーザーの作成:

```bash
npm run create-admin
```

## Configuration

主な環境変数は [`.env.example`](./.env.example) を参照してください。

| 変数 | 説明 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 公開設定 |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー専用（公開しない） |
| `NOTE_RATING_API_URL` | 評価 API のベース URL（未設定なら評価はスキップ） |
| `OPENAI_API_KEY` | AI 分類用（任意） |

## Deploy

本番の正規ルートは **PR を `main` に Merge → Jenkins（`Jenkinsfile`）→ Cloud Run** です。ワンプッシュ（main push での GitHub Actions 自動デプロイ）は使いません。

- Jenkins（PR merge トリガー）: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- 手動 / Cloud Build: [DEPLOYMENT.md](./DEPLOYMENT.md)
- 緊急時のみ: GitHub Actions `Deploy to Cloud Run (manual)`（`workflow_dispatch`）

Jenkins ジョブに `GCP_PROJECT_ID` と Credential（`gcp-sa-key` など）を設定してください。実プロジェクト ID はリポジトリに含めない想定です。

## Docs

- [SPEC.md](./SPEC.md) — 仕様概要
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — アーキテクチャ
- [docs/AUTH_REVIEW.md](./docs/AUTH_REVIEW.md) — 認証レビューメモ
- [DATA_RECOVERY.md](./DATA_RECOVERY.md) — 認証追加後のデータ復元

## License

[MIT](./LICENSE)
