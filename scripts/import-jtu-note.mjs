import { readFileSync } from "fs";
import { supabase } from "./supabase-admin.mjs";

const BUCKET = "note-images";

async function ensureCategory(name) {
  const { data, error } = await supabase
    .from("categories")
    .upsert({ name }, { onConflict: "name" })
    .select("id")
    .single();
  if (error) throw new Error(`Category upsert failed: ${error.message}`);
  return data.id;
}

const images = [
  { file: "/tmp/jtu-images/img-000.png", path: "jtu/membership-2026.png", label: "2026年度会員カード（2027年3月31日迄有効）" },
  { file: "/tmp/jtu-images/img-001.png", path: "jtu/membership-2024.png", label: "2024年度会員カード" },
  { file: "/tmp/jtu-images/img-002.png", path: "jtu/membership-2023.png", label: "2023年度会員カード" },
  { file: "/tmp/jtu-images/img-003.png", path: "jtu/membership-2019.png", label: "2019年度会員カード" },
];

// Upload all images
const urls = [];
for (const img of images) {
  const bytes = readFileSync(img.file);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(img.path, bytes, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`Upload failed (${img.path}): ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(img.path);
  urls.push({ label: img.label, url: data.publicUrl });
  console.log("Uploaded:", img.path);
}

// Build content
const content = `日本トライアスロン連合 (JTU) 会員情報

会員番号: 314-19-00379
加盟団体: 一般社団法人神奈川県トライアスロン連合
登録区分: 一般会員
メール: tetzokabe@gmail.com
JTU会員ページ: https://register.jtu.or.jp/shop/customer/menu.aspx

--- 会員カード ---

${urls.map((u) => `${u.label}\n${u.url}`).join("\n\n")}
`;

console.log("\n--- Content preview ---\n" + content);
const categoryId = await ensureCategory("Sports");

const { data, error } = await supabase
  .from("technical_notes")
  .insert({
    title: "日本トライアスロン連合 JTU 会員証",
    category_id: categoryId,
    tags: ["triathlon", "JTU", "membership", "license"],
    content,
    source_url: "https://register.jtu.or.jp/shop/customer/menu.aspx",
  })
  .select()
  .single();

if (error) { console.error("Insert failed:", error.message); process.exit(1); }
console.log("\nNote inserted, id:", data.id);
