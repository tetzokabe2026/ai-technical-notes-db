// ai-technical-notes-db — PR merge (push to main) → build → Cloud Run
//
// GitHub → Jenkins 想定トリガー:
//   - GitHub webhook: push to `main`（PR マージで発火）
//   - または Multibranch Pipeline で main のみ Deploy ステージ実行
//
// 必要な Jenkins Credentials（ID）:
//   - gcp-sa-key                 : Google service account JSON (Secret file)
//   - next-public-supabase-url   : Secret text
//   - next-public-supabase-anon  : Secret text
//   - next-public-app-url        : Secret text（Cloud Run の本番 URL）
//   - note-rating-api-url        : Secret text（評価 API ベース URL）
//
// 必要な Jenkins 環境変数 / ジョブパラメータ（未設定時はデフォルト）:
//   - GCP_PROJECT_ID（必須）
//   - GCP_REGION（default: asia-northeast1）
//   - AR_REPOSITORY（default: ai-notes）
//   - CLOUD_RUN_SERVICE（default: ai-technical-notes-db）

pipeline {
  agent any

  options {
    // timestamps() は Timestamper プラグイン依存のため使わない
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    GCP_REGION         = "${env.GCP_REGION ?: 'asia-northeast1'}"
    AR_REPOSITORY      = "${env.AR_REPOSITORY ?: 'ai-notes'}"
    CLOUD_RUN_SERVICE  = "${env.CLOUD_RUN_SERVICE ?: 'ai-technical-notes-db'}"
    IMAGE_NAME         = 'ai-technical-notes-db'
  }

  stages {
    stage('Guard: main only') {
      steps {
        script {
          def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
          branch = branch.replaceFirst(/^origin\//, '')
          if (branch != 'main') {
            error("Deploy pipeline runs only on main after PR merge (got: ${branch})")
          }
          if (!env.GCP_PROJECT_ID?.trim()) {
            error('GCP_PROJECT_ID must be set on the Jenkins job / folder')
          }
        }
      }
    }

    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA = sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim()
          env.IMAGE_URI = "${env.GCP_REGION}-docker.pkg.dev/${env.GCP_PROJECT_ID}/${env.AR_REPOSITORY}/${env.IMAGE_NAME}"
          echo "Building ${env.IMAGE_URI}:${env.GIT_SHA}"
        }
      }
    }

    stage('Lint & Test') {
      steps {
        sh '''#!/bin/bash
          set -euo pipefail
          node -v
          npm -v
          npm ci
          npm run lint
          npm test
          NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
          NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key \
          npm run build
        '''
      }
    }

    stage('Build & Push image') {
      steps {
        withCredentials([
          file(credentialsId: 'gcp-sa-key', variable: 'GOOGLE_APPLICATION_CREDENTIALS'),
          string(credentialsId: 'next-public-supabase-url', variable: 'NEXT_PUBLIC_SUPABASE_URL'),
          string(credentialsId: 'next-public-supabase-anon', variable: 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        ]) {
          sh '''#!/bin/bash
            set -euo pipefail
            gcloud auth activate-service-account --key-file="$GOOGLE_APPLICATION_CREDENTIALS"
            gcloud config set project "$GCP_PROJECT_ID"
            gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

            docker build \
              --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
              --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
              -t "${IMAGE_URI}:${GIT_SHA}" \
              -t "${IMAGE_URI}:latest" \
              .

            docker push "${IMAGE_URI}:${GIT_SHA}"
            docker push "${IMAGE_URI}:latest"
          '''
        }
      }
    }

    stage('Deploy Cloud Run') {
      steps {
        withCredentials([
          file(credentialsId: 'gcp-sa-key', variable: 'GOOGLE_APPLICATION_CREDENTIALS'),
          string(credentialsId: 'next-public-app-url', variable: 'NEXT_PUBLIC_APP_URL'),
          string(credentialsId: 'note-rating-api-url', variable: 'NOTE_RATING_API_URL'),
        ]) {
          sh '''#!/bin/bash
            set -euo pipefail
            gcloud auth activate-service-account --key-file="$GOOGLE_APPLICATION_CREDENTIALS"
            gcloud config set project "$GCP_PROJECT_ID"

            gcloud run deploy "$CLOUD_RUN_SERVICE" \
              --image="${IMAGE_URI}:${GIT_SHA}" \
              --region="$GCP_REGION" \
              --platform=managed \
              --allow-unauthenticated \
              --set-env-vars="NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL},OPENAI_MODEL=gpt-5.5,NOTE_RATING_API_URL=${NOTE_RATING_API_URL}" \
              --set-secrets="SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,OPENAI_API_KEY=openai-api-key:latest"
          '''
        }
      }
    }
  }

  post {
    success {
      echo "Deployed ${env.IMAGE_URI}:${env.GIT_SHA} to Cloud Run service ${env.CLOUD_RUN_SERVICE}"
    }
    failure {
      echo 'Jenkins deploy failed. Check credentials, Artifact Registry, and Cloud Run IAM.'
    }
  }
}
