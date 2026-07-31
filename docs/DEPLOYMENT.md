# Jenkins による GCP デプロイ（PR merge トリガー）

本番の正規ルートは **GitHub Actions のワンプッシュではなく**、**PR を `main` にマージ → Jenkins がビルド〜 Cloud Run デプロイ** です。

## 概要

```text
GitHub PR を main へ Merge
  -> push to main（webhook）
    -> Jenkins Pipeline（Jenkinsfile）
      -> lint / test / build
      -> Artifact Registry（Docker image）
      -> Cloud Run
```

| 経路 | トリガー | 内容 |
|---|---|---|
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | PR / `main` への push | GitHub Actions で lint / test / build（品質ゲート） |
| [`Jenkinsfile`](../Jenkinsfile) | **PR merge 後の `main` push**（webhook） | 本番ビルド → Artifact Registry → Cloud Run |
| [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) | **手動のみ** (`workflow_dispatch`) | 緊急時の代替デプロイ |

## 前提条件

- GCP プロジェクト ID
- リージョン: `asia-northeast1`（変更可）
- Artifact Registry リポジトリ: `ai-notes`
- Cloud Run サービス名: `ai-technical-notes-db`
- Jenkins に `gcloud` / Docker が使えるエージェント
- GitHub → Jenkins webhook（`push`、ブランチ `main`）

## 1. GCP 側の準備

### 1.1 デプロイ用サービスアカウント

```bash
export PROJECT_ID=your-gcp-project-id
export REGION=asia-northeast1
export SA_NAME=jenkins-cloud-run-deployer
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "${SA_NAME}" \
  --project="${PROJECT_ID}" \
  --display-name="Jenkins Cloud Run deployer"

for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE}"
done
```

Cloud Run が Secret Manager を参照する場合、**実行用サービスアカウント**に `roles/secretmanager.secretAccessor` を付与します。

```bash
export PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')
export RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

JSON キーを発行し、Jenkins Credential `gcp-sa-key`（Secret file）として登録します。

```bash
gcloud iam service-accounts keys create jenkins-sa.json \
  --iam-account="${SA_EMAIL}"
```

### 1.2 Secret Manager

```bash
echo -n 'your-service-role-key' | gcloud secrets create supabase-service-role-key \
  --project="${PROJECT_ID}" \
  --replication-policy="automatic" \
  --data-file=-

echo -n 'your-openai-api-key' | gcloud secrets create openai-api-key \
  --project="${PROJECT_ID}" \
  --replication-policy="automatic" \
  --data-file=-
```

既存名が異なる場合は `Jenkinsfile` の `--set-secrets` を合わせて変更してください。

### 1.3 Artifact Registry

```bash
gcloud artifacts repositories create ai-notes \
  --repository-format=docker \
  --location="${REGION}" \
  --project="${PROJECT_ID}"
```

## 2. Jenkins ジョブ設定

### 2.1 Pipeline ジョブ

1. **Pipeline script from SCM** でこのリポジトリを指定
2. Script Path: `Jenkinsfile`
3. ブランチ: `*/main`（PR merge 後の main のみデプロイ）
4. ジョブ / フォルダ環境変数:
   - `GCP_PROJECT_ID`（必須）
   - 任意: `GCP_REGION`, `AR_REPOSITORY`, `CLOUD_RUN_SERVICE`

### 2.2 Credentials（ID は Jenkinsfile と一致）

| Credential ID | 種類 | 内容 |
|---|---|---|
| `gcp-sa-key` | Secret file | デプロイ SA の JSON キー |
| `next-public-supabase-url` | Secret text | Supabase URL（Docker build-arg） |
| `next-public-supabase-anon` | Secret text | Supabase anon key（Docker build-arg） |
| `next-public-app-url` | Secret text | 本番アプリ URL |
| `note-rating-api-url` | Secret text | 評価 API ベース URL（`NOTE_RATING_API_URL`） |

### 2.3 GitHub webhook（PR merge トリガー）

PR の Merge は GitHub 上では **`main` への push** として届きます。

1. GitHub リポジトリ → **Settings → Webhooks → Add webhook**
2. Payload URL: `https://<jenkins-host>/github-webhook/`
3. Content type: `application/json`
4. Events: **Just the push event**（または `push` を含む）
5. Jenkins 側: GitHub plugin / Multibranch で webhook を有効化

`Jenkinsfile` の `Guard: main only` により、`main` 以外ではデプロイしません。

## 3. 運用フロー

1. feature ブランチで PR を作成
2. GitHub Actions `CI` が PR で lint / test / build
3. レビュー後に **PR を Merge**
4. `main` への push で Jenkins が起動
5. Jenkins が image を push し Cloud Run へデプロイ
6. Cloud Run URL を確認（初回は `next-public-app-url` を確定値に更新して再デプロイ）

緊急時のみ GitHub Actions の **Deploy to Cloud Run (manual)** を `workflow_dispatch` で実行できます。

## 4. ローカル / 手動との関係

- ローカル: `npm run dev`
- 手動 Cloud Build: `gcloud builds submit --config=cloudbuild.yaml`（substitutions を渡す）
- **本番正規ルート: PR merge → Jenkins → Cloud Run**

## 5. トラブルシューティング

| 症状 | 確認ポイント |
|---|---|
| Jenkins が起動しない | GitHub webhook の Delivery、Jenkins GitHub plugin、`main` ブランチ設定 |
| `Guard: main only` で失敗 | Multibranch が PR ブランチを Deploy しようとしていないか |
| `gcloud auth` 失敗 | Credential `gcp-sa-key` と SA 権限 |
| Docker push 失敗 | Artifact Registry `ai-notes` の有無、`artifactregistry.writer` |
| Cloud Run 500 | Secret Manager 名・runtime SA の `secretAccessor`、`NEXT_PUBLIC_APP_URL` |
| 評価 API が呼ばれない / 星が出ない | Cloud Run に `NOTE_RATING_API_URL` があるか。Jenkins Credential `note-rating-api-url` と再デプロイ。本文は 20〜255 文字必要 |
