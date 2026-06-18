import { readFileSync } from "fs";
import { supabase } from "./supabase-admin.mjs";

const HTML_FILE = "/Users/tetzokabe/Desktop/technotes/トライアスロン記録/トライアスロン記録.html";

async function ensureCategory(name) {
  const { data, error } = await supabase
    .from("categories")
    .upsert({ name }, { onConflict: "name" })
    .select("id")
    .single();
  if (error) throw new Error(`Category upsert failed: ${error.message}`);
  return data.id;
}

function parseContent() {
  const html = readFileSync(HTML_FILE, "utf-8");

  let text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");

  // Block elements → newline
  text = text.replace(/<(br|p|div|h[1-6]|li|tr)[^>]*>/gi, "\n");

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

  // Normalize whitespace
  text = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l, i, arr) => l || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .trim();

  return text;
}

const content = parseContent();
console.log("--- Content preview ---\n" + content.slice(0, 1000));
const categoryId = await ensureCategory("Sports");

const { data, error } = await supabase
  .from("technical_notes")
  .insert({
    title: "トライアスロン記録",
    category_id: categoryId,
    tags: ["triathlon", "race", "record", "swim", "bike", "run"],
    content,
    source_url: null,
  })
  .select()
  .single();

if (error) {
  console.error("Insert failed:", error.message);
  process.exit(1);
}
console.log("\nNote inserted, id:", data.id);
