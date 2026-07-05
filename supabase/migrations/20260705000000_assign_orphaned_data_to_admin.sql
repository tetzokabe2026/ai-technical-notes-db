-- 孤立データ（owner_user_idがNULLのデータ）を管理者に割り当てる
--
-- このマイグレーションは、認証機能追加前に作成されたデータを復元します。
-- owner_user_idがNULLのレコードは、RLSによってアクセスできなくなっているため、
-- 最初の管理者ユーザー（または最初のユーザー）に割り当てます。

DO $$
DECLARE
  target_user_id UUID;
  orphaned_notes_count INT;
  orphaned_categories_count INT;
  orphaned_ai_runs_count INT;
BEGIN
  -- 割り当て先のユーザーを決定（優先順位: admin > 最初のユーザー）
  SELECT id INTO target_user_id
  FROM app_users
  WHERE role = 'admin' AND status = 'approved'
  ORDER BY created_at ASC
  LIMIT 1;

  -- 管理者がいない場合は、承認済みの最初のユーザーを使用
  IF target_user_id IS NULL THEN
    SELECT id INTO target_user_id
    FROM app_users
    WHERE status = 'approved'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- ユーザーが存在する場合のみ処理を実行
  IF target_user_id IS NOT NULL THEN
    -- 孤立した技術メモを割り当て
    UPDATE technical_notes
    SET owner_user_id = target_user_id
    WHERE owner_user_id IS NULL;
    
    GET DIAGNOSTICS orphaned_notes_count = ROW_COUNT;
    RAISE NOTICE '技術メモ % 件をユーザー % に割り当てました', orphaned_notes_count, target_user_id;

    -- 孤立したカテゴリを割り当て
    UPDATE categories
    SET owner_user_id = target_user_id
    WHERE owner_user_id IS NULL;
    
    GET DIAGNOSTICS orphaned_categories_count = ROW_COUNT;
    RAISE NOTICE 'カテゴリ % 件をユーザー % に割り当てました', orphaned_categories_count, target_user_id;

    -- 孤立したAI分類ランを割り当て
    UPDATE ai_classification_runs
    SET owner_user_id = target_user_id
    WHERE owner_user_id IS NULL;
    
    GET DIAGNOSTICS orphaned_ai_runs_count = ROW_COUNT;
    RAISE NOTICE 'AI分類ラン % 件をユーザー % に割り当てました', orphaned_ai_runs_count, target_user_id;

  ELSE
    RAISE WARNING '承認済みユーザーが存在しないため、孤立データの割り当てをスキップしました';
    RAISE WARNING '管理者ユーザーを作成してから、このマイグレーションを再実行してください';
  END IF;

END $$;

-- RLSポリシーを追加して、ユーザーが自分のデータにアクセスできるようにする
-- （ポリシーがまだ存在しない場合）

DO $$
BEGIN
  -- technical_notesのRLSポリシー
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'technical_notes' AND policyname = 'Users can access their own notes'
  ) THEN
    CREATE POLICY "Users can access their own notes"
      ON technical_notes
      FOR ALL
      USING (
        owner_user_id IN (
          SELECT id FROM app_users 
          WHERE auth_user_id = auth.uid()
        )
      );
    RAISE NOTICE 'technical_notesのRLSポリシーを作成しました';
  END IF;

  -- categoriesのRLSポリシー
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'categories' AND policyname = 'Users can access their own categories'
  ) THEN
    CREATE POLICY "Users can access their own categories"
      ON categories
      FOR ALL
      USING (
        owner_user_id IN (
          SELECT id FROM app_users 
          WHERE auth_user_id = auth.uid()
        )
      );
    RAISE NOTICE 'categoriesのRLSポリシーを作成しました';
  END IF;

  -- ai_classification_runsのRLSポリシー
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_classification_runs' AND policyname = 'Users can access their own AI runs'
  ) THEN
    CREATE POLICY "Users can access their own AI runs"
      ON ai_classification_runs
      FOR ALL
      USING (
        owner_user_id IN (
          SELECT id FROM app_users 
          WHERE auth_user_id = auth.uid()
        )
      );
    RAISE NOTICE 'ai_classification_runsのRLSポリシーを作成しました';
  END IF;

  -- note_ai_classificationsのRLSポリシー
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'note_ai_classifications' AND policyname = 'Users can access classifications for their runs'
  ) THEN
    CREATE POLICY "Users can access classifications for their runs"
      ON note_ai_classifications
      FOR ALL
      USING (
        run_id IN (
          SELECT id FROM ai_classification_runs 
          WHERE owner_user_id IN (
            SELECT id FROM app_users 
            WHERE auth_user_id = auth.uid()
          )
        )
      );
    RAISE NOTICE 'note_ai_classificationsのRLSポリシーを作成しました';
  END IF;

END $$;
