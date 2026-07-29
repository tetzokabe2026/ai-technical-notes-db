# GitHub Actions による GCP デプロイ

このドキュメントでは、GitHub Actions から Google Cloud Run へ自動デプロイするためのセットアップ手順を説明します。

## 概要

```text
GitHub (push to main)
  -> GitHub Actions (CI: lint/build, CD: deploy)
    -> Artifact Registry (Docker image)
    -> Cloud Run
    -> Supabase / OpenAI / Resend
```

| ワークフロー | トリガー | 内容 |
|---|---|---|
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | PR / `main` への push | `npm run lint` と `npm run build` |
| [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) | `main` への push / 手動実行 | Docker ビルド → Artifact Registry → Cloud Run |

## 前提条件

- GCP プロジェクト ID（ご自身のプロジェクト）
- リージョン: `asia-northeast1`（変更可）
- Artifact Registry リポジトリ: `ai-notes`
- Cloud Run サービス名: `ai-technical-notes-db`
- GitHub リポジトリ（このリポジトリ）

## 1. GCP 側の準備

### 1.1 デプロイ用サービスアカウント

```bash
export PROJECT_ID=your-gcp-project-id
export REGION=asia-northeast1
export SA_NAME=github-actions-deployer
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "${SA_NAME}" \
  --project="${PROJECT_ID}" \
  --display-name="GitHub Actions deployer"

for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE}"
done
```

Cloud Run が Secret Manager のシークレットを参照する場合、**Cloud Run の実行用サービスアカウント**（通常は `PROJECT_NUMBER-compute@developer.gserviceaccount.com`）に `roles/secretmanager.secretAccessor` を付与してください。

```bash
export PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')
export RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

### 1.2 Secret Manager

Cloud Run 実行時に必要なシークレットを登録します。シークレット名はワークフローと一致させてください。

```bash
# 例: 既存の値を登録
echo -n 'your-service-role-key' | gcloud secrets create supabase-service-role-key \
  --project="${PROJECT_ID}" \
  --replication-policy="automatic" \
  --data-file=-

echo -n 'your-openai-api-key' | gcloud secrets create openai-api-key \
  --project="${PROJECT_ID}" \
  --replication-policy="automatic" \
  --data-file=-
```

既存シークレット名が異なる場合は、`.github/workflows/deploy.yml` の `secrets:` 行を合わせて変更してください。

### 1.3 Workload Identity Federation（推奨）

長期間有効なサービスアカウントキーを使わず、GitHub から GCP へ安全に認証する方法です。

```bash
export PROJECT_ID=your-gcp-project-id
export GITHUB_ORG=your-github-org-or-user
export GITHUB_REPO=ai-technical-notes-db
export SA_EMAIL="github-actions-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
export POOL_ID=github-pool
export PROVIDER_ID=github-provider

gcloud iam workload-identity-pools create "${POOL_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions pool"

gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_ID}" \
  --display-name="GitHub provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}"
```

セットアップ後、以下の値を控えます。

```bash
# Workload Identity Provider（GitHub Secret に登録）
gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_ID}" \
  --format='value(name)'
```

## 2. GitHub リポジトリの設定

GitHub リポジトリの **Settings → Secrets and variables → Actions** で以下を登録します。

### Variables（必須）

| 名前 | 説明 |
|---|---|
| `GCP_PROJECT_ID` | GCP プロジェクト ID |

### Secrets（必須）

| 名前 | 説明 |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | WIF プロバイダの完全なリソース名 |
| `GCP_SERVICE_ACCOUNT` | `github-actions-deployer@your-gcp-project-id.iam.gserviceaccount.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL（Docker ビルド時に埋め込み） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key（Docker ビルド時に埋め込み） |
| `NEXT_PUBLIC_APP_URL` | 本番アプリ URL（例: `https://ai-technical-notes-db-xxxxx.a.run.app`） |

### 代替: サービスアカウントキー（非推奨）

WIF の設定が難しい場合のみ、JSON キーを `GCP_SA_KEY` として登録し、`deploy.yml` の認証ステップを以下に差し替えます。

```yaml
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    credentials_json: ${{ secrets.GCP_SA_KEY }}
```

## 3. 初回デプロイ

1. 上記の GCP / GitHub 設定を完了する
2. 変更を `main` ブランチに push する
3. GitHub の **Actions** タブで `Deploy to Cloud Run` の実行結果を確認する
4. デプロイ完了後、Cloud Run の URL を `NEXT_PUBLIC_APP_URL` に反映する（初回は仮 URL でデプロイし、確定後に再デプロイ）

手動デプロイは **Actions → Deploy to Cloud Run → Run workflow** から実行できます。

## 4. ローカル開発との関係

- ローカル開発: `npm run dev`（従来どおり）
- 手動デプロイ: `gcloud builds submit --config=cloudbuild.yaml` も引き続き利用可能（`_PROJECT_ID` 等の substitution を渡す）
- 本番デプロイの正規ルート: **`main` への merge**

Cursor から直接 GCP へデプロイする必要はありません。コードを GitHub に push すれば CI/CD が自動実行されます。

## 5. トラブルシューティング

| 症状 | 確認ポイント |
|---|---|
| 認証エラー | WIF の `attribute.repository` が GitHub リポジトリと一致しているか |
| Docker push 失敗 | Artifact Registry リポジトリ `ai-notes` が存在するか、SA に `artifactregistry.writer` があるか |
| Cloud Run 起動後 500 エラー | Secret Manager のシークレット名・権限、環境変数 `NEXT_PUBLIC_APP_URL` |
| ビルド失敗 | GitHub Secrets の `NEXT_PUBLIC_SUPABASE_*` / Variables の `GCP_PROJECT_ID` が設定されているか |
| 評価 API が呼ばれない | `NOTE_RATING_API_URL` が Cloud Run / ローカル環境に設定されているか |
