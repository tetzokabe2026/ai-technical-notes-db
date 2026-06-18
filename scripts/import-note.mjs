import { readFileSync } from "fs";
import { supabase } from "./supabase-admin.mjs";

const NOTE_DIR = "/Users/tetzokabe/Desktop/technotes/Bridgestone BG-100";
const HTML_FILE = `${NOTE_DIR}/Bridgestone BG-100.html`;
const IMAGE_FILE = `${NOTE_DIR}/Bridgestone BG-100 files/Image 20260208 091443.png`;
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

// --- 1. Ensure storage bucket exists ---
async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) throw new Error(`Create bucket failed: ${error.message}`);
    console.log("Created bucket:", BUCKET);
  } else {
    console.log("Bucket already exists:", BUCKET);
  }
}

// --- 2. Upload image ---
async function uploadImage() {
  const imageBytes = readFileSync(IMAGE_FILE);
  const storagePath = "bridgestone-bg100/Image_20260208_091443.png";
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, imageBytes, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  console.log("Image uploaded:", data.publicUrl);
  return data.publicUrl;
}

// --- 3. Parse HTML content ---
function parseContent(imageUrl) {
  const html = readFileSync(HTML_FILE, "utf-8");

  // Strip style/script blocks
  let text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");

  // Replace img tags with image URL placeholder
  text = text.replace(/<img[^>]*src="[^"]*"[^>]*>/gi, `\n[画像: ${imageUrl}]\n`);

  // Replace block elements with newlines
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

  // Collapse whitespace/blank lines
  text = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l, i, arr) => l || (arr[i - 1] && arr[i - 1] !== ""))
    .join("\n")
    .trim();

  return text;
}

// --- 4. Insert note ---
async function insertNote(content) {
  const categoryId = await ensureCategory("Golf");
  const { data, error } = await supabase.from("technical_notes").insert({
    title: "Bridgestone BG-100",
    category_id: categoryId,
    tags: ["golf", "club", "bridgestone", "equipment"],
    content,
    source_url: "https://jp.golf.bridgestone/img/goods/freeimages/BG100_1.jpg",
  }).select().single();
  if (error) throw new Error(`Insert failed: ${error.message}`);
  console.log("Note inserted, id:", data.id);
  return data;
}

// --- main ---
(async () => {
  try {
    await ensureBucket();
    const imageUrl = await uploadImage();
    const content = parseContent(imageUrl);
    console.log("\n--- Parsed content preview ---\n" + content.slice(0, 500));
    const note = await insertNote(content);
    console.log("\nDone!", note);
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
})();
