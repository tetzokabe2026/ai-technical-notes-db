# AI Technical Notes DB プロジェクト概要

## 概要

AI Technical Notes DB は、技術メモを登録・検索・分類するための Next.js アプリケーションです。Supabase をデータベースと認証基盤として使い、Cloud Run 上でコンテナとして運用する構成です。

主な機能は以下です。

- 技術メモの登録、一覧、検索、削除
- 階層カテゴリ管理
- OpenAI API によるカテゴリ・タグ・タイトル候補の提案
- Supabase Auth を使ったログイン、サインアップ、パスワードリセット
- 管理者画面によるユーザー申請の承認・却下・削除・パスワードリセット
- ユーザーごとのメモ・カテゴリ分離

## 技術スタック

- Frontend / Backend: Next.js App Router
- Language: TypeScript
- UI: React 19, Tailwind CSS
- Database: Supabase Postgres
- Authentication: Supabase Auth
- Mail Delivery: Supabase Auth の Custom SMTP 経由で Resend を利用
- AI: OpenAI Responses API
- Deployment: Docker + Google Cloud Build + Google Cloud Run
- Container Registry: Google Artifact Registry

## 主要ディレクトリ

```text
app/
  page.tsx                         メモ一覧・検索・登録のメイン画面
  categories/page.tsx              カテゴリ管理画面
  login/page.tsx                   ログイン・パスワードリセット開始画面
  signup/page.tsx                  サインアップ申請画面
  setup/page.tsx                   承認後の初期アカウント設定画面
  reset-password/page.tsx          パスワード再設定画面
  admin/page.tsx                   管理者画面
  api/                             Next.js Route Handlers

lib/
  auth.ts                          Cookieセッションと認可ヘルパー
  supabase.ts                      ブラウザ向けSupabase型・クライアント
  supabase-server.ts               service role用Supabaseクライアント
  supabase-auth.ts                 Supabase Auth用クライアント
  ai-classification.ts             OpenAIによる分類・カテゴリ補助
  url.ts                           アプリURL生成ヘルパー

supabase/
  migrations/                      DBスキーマ変更履歴
  config.toml                      Supabase CLI設定

scripts/
  create-admin-user.mjs            初期管理者作成スクリプト
  import-*.mjs                     メモ投入用スクリプト

Dockerfile                         本番コンテナ定義
cloudbuild.yaml                    Cloud Build設定
```

## 認証・ユーザー管理

ログイン自体は Supabase Auth のメールアドレス・パスワード認証を使います。アプリ独自の `app_users` テーブルは、承認ステータス、管理者権限、ユーザーID表示名、Supabase Authユーザーとの対応付けを管理します。

ユーザー申請の流れは以下です。

1. ユーザーが `/signup` でメールアドレスを申請
2. `app_users` に `pending` として登録
3. 管理者が `/admin` で承認
4. Supabase Auth の招待/設定フローでアカウントを有効化
5. ユーザーはメールアドレスとパスワードでログイン

パスワードリセットは Supabase Auth の recovery mail を使います。メール送信は Supabase Auth の Custom SMTP 設定から Resend 経由で行います。

## データ分離

技術メモとカテゴリには `owner_user_id` があり、アプリのAPI側でログインユーザーのデータだけを読み書きします。ブラウザから直接DBを広く操作しないよう、主なCRUDは Next.js API Routes 経由です。

主なテーブルは以下です。

- `app_users`
- `technical_notes`
- `categories`
- `ai_classification_runs`
- `note_ai_classifications`

Supabaseのpublic schema上のテーブルはRLSを有効化し、基本的にサーバー側のservice role経由で操作します。

## デプロイ構成

本番は Google Cloud Run にデプロイします。CI/CD は GitHub Actions が担当します。

```text
GitHub (push to main)
  -> GitHub Actions (CI: lint/build, CD: deploy)
  -> Artifact Registry
  -> Cloud Run
  -> Supabase / OpenAI / Resend
```

システムの責務境界・認証・CI/CD の構成は [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)、セットアップ手順は [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) を参照してください。

Cloud Run の主な環境変数・シークレットは以下です。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY` Secret Manager経由
- `OPENAI_API_KEY` Secret Manager経由
- `OPENAI_MODEL`

## 開発コマンド

```bash
npm run dev
npm run lint
npm run build
npm run create-admin
```

初期管理者を作る場合は、`.env.local` に `ADMIN_EMAIL`, `ADMIN_USER_ID`, `ADMIN_PASSWORD` を設定して `npm run create-admin` を実行します。
