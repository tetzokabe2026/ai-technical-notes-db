import { supabase } from "./supabase-admin.mjs";

async function ensureCategory(name) {
  const { data, error } = await supabase
    .from("categories")
    .upsert({ name }, { onConflict: "name" })
    .select("id")
    .single();
  if (error) throw new Error(`Category upsert failed: ${error.message}`);
  return data.id;
}

const content = `Category     | Service                        | Spending  | Date
-------------|--------------------------------|-----------|------
ほぼ固定     | PRUDENTIAL                     | 247,056   | 月末
ほぼ固定     | MORGAGE                        | 269,900   | 月末
ほぼ固定     | au Pay（平均）                 | 3,800     | 10日
ほぼ固定     | J:Com（平均）                  | 55,000    | 1日
可変         | FAMIPAY                        | —         | 月末
可変         | PAYPAY                         | —         | 月末
可変         | SMBC-VISA (ANA)                | —         | 10日
可変         | SMBC-MASTER (AMAZON)           | —         | 月末
固定         | ORIENT CORP                    | 121,467   | 月末
固定         | PACIFIC GOLF                   | 18,700    | 月末
固定         | OUTDOOR FITNESS                | 13,260    | 月末
固定         | PAIDY                          | 22,583    | 月末
固定         | あいおいニッセイ同和損保       | 18,100    | 月末
固定         | Benevity Donation              | 10,000    | 月末

月末固定合計: ¥721,066

--- 不明な支出 ---

10/01(水) J:COM その他利用 -55,264
※ 9月分が支払われていなかったので？`;

console.log("--- Content ---\n" + content);

const categoryId = await ensureCategory("Finance");

const { data, error } = await supabase
  .from("technical_notes")
  .insert({
    title: "毎月の支払い",
    category_id: categoryId,
    tags: ["payment", "monthly", "expense", "固定費"],
    content,
    source_url: null,
  })
  .select()
  .single();

if (error) { console.error("Insert failed:", error.message); process.exit(1); }
console.log("\nNote inserted, id:", data.id);
