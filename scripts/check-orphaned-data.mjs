#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("エラー: Supabaseの環境変数が設定されていません。");
  console.error("必要な環境変数:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  console.error("\n.envファイルを作成するか、環境変数を設定してください。");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});

console.log("=== 孤立データの確認 ===\n");

try {
  const { data: notes, error: notesError } = await supabase
    .from("technical_notes")
    .select("*")
    .is("owner_user_id", null);

  if (notesError) {
    console.error("技術メモの取得エラー:", notesError);
  } else {
    console.log(`owner_user_idがNULLの技術メモ: ${notes.length}件`);
    
    if (notes.length > 0) {
      console.log("\n--- データサンプル ---");
      notes.slice(0, 5).forEach((note, index) => {
        console.log(`\n[${index + 1}] ID: ${note.id}`);
        console.log(`    タイトル: ${note.title}`);
        console.log(`    カテゴリ: ${note.category || "(なし)"}`);
        console.log(`    作成日: ${note.created_at}`);
        console.log(`    所有者ID: ${note.owner_user_id}`);
      });
      
      if (notes.length > 5) {
        console.log(`\n... 他 ${notes.length - 5}件`);
      }
    }
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("*")
    .is("owner_user_id", null);

  if (categoriesError) {
    console.error("\nカテゴリの取得エラー:", categoriesError);
  } else {
    console.log(`\nowner_user_idがNULLのカテゴリ: ${categories.length}件`);
    
    if (categories.length > 0) {
      console.log("\n--- カテゴリサンプル ---");
      categories.slice(0, 5).forEach((category, index) => {
        console.log(`\n[${index + 1}] ID: ${category.id}`);
        console.log(`    名前: ${category.name}`);
        console.log(`    パス: ${category.path?.join(" > ") || "(なし)"}`);
        console.log(`    作成日: ${category.created_at}`);
        console.log(`    所有者ID: ${category.owner_user_id}`);
      });
      
      if (categories.length > 5) {
        console.log(`\n... 他 ${categories.length - 5}件`);
      }
    }
  }

  const { data: allNotes, error: allNotesError } = await supabase
    .from("technical_notes")
    .select("id");

  if (!allNotesError) {
    console.log(`\n=== 合計 ===`);
    console.log(`全技術メモ数: ${allNotes.length}件`);
  }

  const { data: users, error: usersError } = await supabase
    .from("app_users")
    .select("id, email, status, role");

  if (usersError) {
    console.error("\nユーザーの取得エラー:", usersError);
  } else {
    console.log(`\n登録ユーザー数: ${users.length}人`);
    
    if (users.length > 0) {
      console.log("\n--- ユーザー一覧 ---");
      users.forEach((user, index) => {
        console.log(`[${index + 1}] ${user.email} (${user.role}, ${user.status})`);
      });
    }
  }

  console.log("\n=== 結論 ===");
  if (notes && notes.length > 0) {
    console.log("✅ 以前のデータは残っています！");
    console.log("   owner_user_idがNULLのため、現在のユーザーからはアクセスできない状態です。");
    console.log("\n💡 対応方法:");
    console.log("   1. 既存データに所有者を割り当てるマイグレーションを作成");
    console.log("   2. または、owner_user_idがNULLでもアクセスできるようにRLSポリシーを追加");
  } else {
    console.log("❌ owner_user_idがNULLのデータは見つかりませんでした。");
  }

} catch (error) {
  console.error("予期しないエラー:", error);
  process.exit(1);
}
