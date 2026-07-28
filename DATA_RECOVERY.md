# データ復元ガイド

## 問題の概要

認証機能を追加した際、既存のデータが見えなくなってしまいました。データ自体は削除されていませんが、Row Level Security (RLS)によってアクセスできない状態になっています。

## 原因

2026年6月25日の認証機能追加マイグレーション（v1.3リリース）で、以下の変更が行われました：

1. ✅ `technical_notes`、`categories`、`ai_classification_runs`テーブルに`owner_user_id`カラムが追加
2. ✅ Row Level Security (RLS)が有効化
3. ❌ **既存データに`owner_user_id`を設定する処理が抜けていた**

結果として、認証機能追加前に作成されたすべてのデータは`owner_user_id = NULL`のまま残っており、RLSポリシーがないため誰もアクセスできない「孤立データ」になっています。

## データの状態

- ❌ **削除されていません** - データベースに残っています
- ⚠️ **アクセス不可** - RLSによって誰もアクセスできません
- ✅ **復元可能** - マイグレーションで復元できます

## 復元手順

### 前提条件

1. Supabaseローカルインスタンスが起動している、またはSupabaseプロジェクトにアクセスできること
2. 管理者ユーザーが作成されていること（`scripts/create-admin-user.mjs`を使用）

### ステップ1: 環境変数の設定

`.env`ファイルを作成し、必要な環境変数を設定します：

```bash
cp .env.example .env
```

`.env`ファイルを編集して、以下の値を設定：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_EMAIL=admin@example.com
ADMIN_USER_ID=admin
ADMIN_PASSWORD=your_secure_password
```

### ステップ2: 管理者ユーザーの作成（まだの場合）

```bash
node scripts/create-admin-user.mjs
```

このスクリプトは管理者ユーザーを作成し、自動的に承認済み（approved）状態にします。

### ステップ3: データ復元マイグレーションの適用

#### ローカルSupabaseの場合：

```bash
supabase db reset
```

または

```bash
supabase migration up
```

#### リモートSupabaseの場合：

Supabase Studioで以下のSQLを実行：

```sql
-- /workspace/supabase/migrations/20260705000000_assign_orphaned_data_to_admin.sql の内容を実行
```

### ステップ4: データの確認

作成した確認スクリプトを実行して、データが復元されたか確認：

```bash
node scripts/check-orphaned-data.mjs
```

このスクリプトは以下を表示します：
- owner_user_idがNULLの技術メモの件数
- owner_user_idがNULLのカテゴリの件数
- 全データの件数
- 登録ユーザーの一覧

### ステップ5: ログインしてデータを確認

1. アプリケーションを起動：
   ```bash
   npm run dev
   ```

2. ブラウザで`http://localhost:3000`にアクセス

3. 管理者アカウントでログイン

4. 以前のデータが表示されることを確認

## マイグレーションの動作

新しいマイグレーション（`20260705000000_assign_orphaned_data_to_admin.sql`）は以下を実行します：

### 1. 孤立データの割り当て

- owner_user_idがNULLのすべてのレコードを検索
- 最初の管理者ユーザー（または最初の承認済みユーザー）に割り当て
- 対象テーブル：
  - `technical_notes`（技術メモ）
  - `categories`（カテゴリ）
  - `ai_classification_runs`（AI分類ラン）

### 2. RLSポリシーの作成

各テーブルに、ユーザーが自分のデータにアクセスできるようにするポリシーを追加：

- ユーザーは自分の`owner_user_id`に一致するレコードのみ閲覧・編集可能
- `app_users`テーブルの`auth_user_id`とSupabase Authの`auth.uid()`を照合

## トラブルシューティング

### Q: マイグレーション後もデータが表示されない

**A:** 以下を確認してください：

1. 管理者ユーザーが作成され、承認済み（approved）状態になっているか
2. 正しいアカウントでログインしているか
3. RLSポリシーが正しく作成されているか（Supabase Studioで確認）

### Q: 「承認済みユーザーが存在しない」という警告が表示される

**A:** 管理者ユーザーを作成してから、マイグレーションを再実行してください：

```bash
node scripts/create-admin-user.mjs
supabase migration up
```

### Q: 複数ユーザーで使用していた場合はどうなる？

**A:** このマイグレーションは、すべての孤立データを**1人のユーザー**（最初の管理者）に割り当てます。複数ユーザーで使用していた場合は、手動でデータを再割り当てする必要があります。

Supabase Studioで以下のようなSQLを実行：

```sql
-- 特定のメモを別のユーザーに移動
UPDATE technical_notes
SET owner_user_id = (SELECT id FROM app_users WHERE email = 'user2@example.com')
WHERE title LIKE '%特定のキーワード%';
```

### Q: データが本当に残っているか確認したい

**A:** 確認スクリプトを実行してください：

```bash
node scripts/check-orphaned-data.mjs
```

このスクリプトはservice_roleキーを使用してRLSをバイパスし、すべてのデータを表示します。

## 今後の対応

このような問題を防ぐため、以下の改善が推奨されます：

1. ✅ **マイグレーションのテスト** - 本番環境に適用する前に、ローカルで十分にテストする
2. ✅ **データ移行の明示的な処理** - スキーマ変更時は、既存データの移行も必ず含める
3. ✅ **RLSポリシーの事前作成** - RLSを有効化する前に、必要なポリシーをすべて作成する
4. ✅ **バックアップ** - 重要な変更の前に、データベースのバックアップを取る

## 参考情報

- マイグレーションファイル: `supabase/migrations/20260705000000_assign_orphaned_data_to_admin.sql`
- 確認スクリプト: `scripts/check-orphaned-data.mjs`
- 管理者作成スクリプト: `scripts/create-admin-user.mjs`
- 問題のマイグレーション: `supabase/migrations/20260625090000_add_app_auth_and_user_scoping.sql`
