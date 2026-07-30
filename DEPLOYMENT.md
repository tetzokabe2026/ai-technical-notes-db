# デプロイガイド

このドキュメントでは、AI Technical Notes DBアプリケーションをGoogle Cloud Platformにデプロイする手順を説明します。

## 前提条件

### 1. Supabaseプロジェクトの設定

Supabase（https://supabase.com）でプロジェクトを作成し、以下の情報を取得してください：

- **Project URL**: `https://your-project.supabase.co`
- **Anon/Public Key**: プロジェクト設定の「API」セクションで確認
- **Service Role Key**: プロジェクト設定の「API」セクションで確認（シークレット）

### 2. 必要な環境変数

以下の環境変数を設定する必要があります：

#### Cursor Dashboard Secrets（Cloud Agent用）

Cursor Dashboard（https://cursor.com/settings）の「Cloud Agents > Secrets」で以下を設定：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ACCESS_TOKEN=your_personal_access_token
ADMIN_EMAIL=admin@example.com
ADMIN_USER_ID=admin
ADMIN_PASSWORD=your_secure_password
OPENAI_API_KEY=your_openai_api_key (オプション)
```

**Supabase Access Token**の取得方法：
1. Supabase Dashboard（https://supabase.com/dashboard）にログイン
2. 右上のアカウントメニュー > Account Settings
3. Access Tokens > Generate new token
4. トークンをコピーして、Cursor Dashboardに設定

#### Google Cloud Platform変数

Google Cloud Buildの置換変数として設定：

```
_SUPABASE_URL=https://your-project.supabase.co
_SUPABASE_ANON_KEY=your_anon_key
```

### 3. ツールのインストール

```bash
# Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# Supabase CLI（既にインストール済み）
supabase --version
```

## デプロイ手順

### ステップ1: Supabaseマイグレーションの適用

#### オプションA: Supabase CLIを使用（推奨）

```bash
# Supabaseプロジェクトにリンク
cd /workspace
supabase link --project-ref your-project-ref

# マイグレーションを適用
supabase db push

# または、すべてのマイグレーションを確認してから適用
supabase db diff
supabase db push
```

#### オプションB: Supabase Studioで手動適用

1. Supabase Dashboard（https://supabase.com/dashboard）にアクセス
2. プロジェクトを選択
3. 「SQL Editor」を開く
4. 各マイグレーションファイルの内容を順番に実行：
   - `supabase/migrations/20260602133240_create_technical_notes.sql`
   - `supabase/migrations/20260602213316_add_storage_policy.sql`
   - ... (すべて)
   - `supabase/migrations/20260705000000_assign_orphaned_data_to_admin.sql`

### ステップ2: 管理者ユーザーの作成

```bash
# 環境変数を読み込み
export NEXT_PUBLIC_SUPABASE_URL="your_url"
export SUPABASE_SERVICE_ROLE_KEY="your_key"
export ADMIN_EMAIL="admin@example.com"
export ADMIN_USER_ID="admin"
export ADMIN_PASSWORD="your_password"

# 管理者ユーザーを作成
node scripts/create-admin-user.mjs
```

### ステップ3: データの復元確認（オプション）

```bash
# 孤立データを確認
node scripts/check-orphaned-data.mjs
```

このスクリプトは、以下を表示します：
- owner_user_idがNULLの技術メモとカテゴリの件数
- データのサンプル
- 登録ユーザーの一覧

### ステップ4: Google Cloud Buildでアプリケーションをビルド＆デプロイ

```bash
# Google Cloudプロジェクトを設定
gcloud config set project your-gcp-project-id

# Artifact Registryの認証
gcloud auth configure-docker asia-northeast1-docker.pkg.dev

# ビルドを実行（プロジェクト ID は substitution で渡す）
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_PROJECT_ID=your-gcp-project-id,_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL",_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

ビルドが完了すると、Dockerイメージが以下のレジストリに保存されます：
```
asia-northeast1-docker.pkg.dev/your-gcp-project-id/ai-notes/ai-technical-notes-db:latest
```

### ステップ5: Cloud Runにデプロイ（オプション）

```bash
# Cloud Runサービスをデプロイ
gcloud run deploy ai-technical-notes-db \
  --image asia-northeast1-docker.pkg.dev/your-gcp-project-id/ai-notes/ai-technical-notes-db:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --set-secrets="SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest"
```

**注意**: シークレットは事前にGoogle Cloud Secret Managerに登録しておく必要があります。

```bash
# シークレットを作成
echo -n "your_service_role_key" | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=-
echo -n "your_openai_api_key" | gcloud secrets create OPENAI_API_KEY --data-file=-
```

## デプロイ後の確認

### 1. アプリケーションの動作確認

```bash
# Cloud RunのURLを取得
gcloud run services describe ai-technical-notes-db \
  --region asia-northeast1 \
  --format='value(status.url)'
```

ブラウザで上記のURLにアクセスして、以下を確認：

1. ログイン画面が表示されるか
2. 管理者アカウントでログインできるか
3. 以前のデータが表示されるか
4. 新しいメモを作成できるか

### 2. ログの確認

```bash
# Cloud Runのログを確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=ai-technical-notes-db" \
  --limit 50 \
  --format json
```

## トラブルシューティング

### マイグレーションが失敗する

**エラー**: `relation "technical_notes" already exists`

**解決策**: すでに一部のマイグレーションが適用されている可能性があります。

```bash
# 適用済みのマイグレーションを確認
supabase migration list

# 特定のマイグレーションをスキップ
supabase db push --exclude-all --include 20260705000000_assign_orphaned_data_to_admin
```

### ビルドが失敗する

**エラー**: `ERROR: failed to solve: failed to fetch anonymous token`

**解決策**: Docker Buildxのバージョンを確認し、ネットワーク接続を確認してください。

```bash
# ビルドログを確認
gcloud builds list --limit=5
gcloud builds log <BUILD_ID>
```

### データが表示されない

**考えられる原因**:
1. マイグレーション`20260705000000_assign_orphaned_data_to_admin.sql`が適用されていない
2. 管理者ユーザーが作成されていない
3. RLSポリシーが正しく設定されていない

**解決策**:

```bash
# 確認スクリプトを実行
node scripts/check-orphaned-data.mjs

# Supabase Studioでデータを確認
# https://supabase.com/dashboard/project/your-project/editor
```

## 継続的デプロイメント（CI/CD）

本番の正規ルートは **PR Merge → Jenkins → Cloud Run** です（ワンプッシュ / GitHub Actions 自動デプロイは使いません）。

詳細は [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) とルートの [`Jenkinsfile`](./Jenkinsfile) を参照してください。

```text
PR を main へ Merge
  -> GitHub push webhook
    -> Jenkins (Jenkinsfile)
      -> lint / test / docker build & push
      -> gcloud run deploy
```

GitHub Actions の `.github/workflows/deploy.yml` は **手動 (`workflow_dispatch`) のみ**残しています。

## まとめ

デプロイの全体フロー：

1. ✅ PRをマージ（本番デプロイのトリガー）
2. ⏳ Jenkins がビルド〜 Cloud Run デプロイ
3. ⏳ 初回のみ Supabaseマイグレーション / 管理者ユーザー作成
4. ⏳ データ復元を確認（必要な場合）
5. ⏳ 動作確認

ご不明な点があれば、[DATA_RECOVERY.md](./DATA_RECOVERY.md)も参照してください。
