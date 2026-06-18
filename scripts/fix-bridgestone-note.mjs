import { supabase } from "./supabase-admin.mjs";

const IMAGE_URL =
  "https://chkricjngyhcbulxkgjm.supabase.co/storage/v1/object/public/note-images/bridgestone-bg100/Image_20260208_091443.png";

const content = `## ロフト角・飛距離目安

| クラブ | ロフト角 | 差 | 飛距離 (yd) |
|--------|----------|-----|------------|
| 1W     | 9.5°    | —   | 230        |
| 5W     | 19°     | -9.5| 200        |
| U4     | 24°     | -5  | 180        |
| 6I     | 25°     | -1  | 155        |
| 7I     | 28°     | -3  | 145        |
| 8I     | 33°     | -5  | 135        |
| 9I     | 38°     | -5  | 125        |
| PW     | 44°     | -6  | 110        |
| AW     | 50°     | -6  | 95         |
| SW     | 56°     | -6  | 80         |

> 自分の3/4スイングで平均的な飛距離を割り出す

## PW スペック

- **ロフト角**: 44度
- **ヘッドスピード**: 40m/s → 100〜110ヤード

## クラブ画像

![Bridgestone BG-100](${IMAGE_URL})
`;

const { data, error } = await supabase
  .from("technical_notes")
  .update({ content })
  .eq("title", "Bridgestone BG-100")
  .select("id")
  .single();

if (error) {
  console.error("Update failed:", error.message);
  process.exit(1);
}
console.log("Updated note id:", data.id);
