import { createClient } from "@supabase/supabase-js";

export type Category = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type TechnicalNote = {
  id: string;
  title: string;
  category_id: string | null;
  categories: Pick<Category, "id" | "name"> | null;
  tags: string[];
  content: string;
  source_url: string | null;
  created_at: string;
  updated_at: string;
};

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
