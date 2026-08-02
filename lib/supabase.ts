import { createClient } from "@supabase/supabase-js";

export type Category = {
  id: string;
  owner_user_id: string | null;
  name: string;
  parent_id: string | null;
  description: string | null;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
};

export type TechnicalNote = {
  id: string;
  owner_user_id: string | null;
  title: string;
  category_id: string | null;
  categories: Pick<Category, "id" | "name"> | null;
  tags: string[];
  content: string;
  source_url: string | null;
  rating_eval_id: string | null;
  rating_usefulness: number | null;
  rating_importance: number | null;
  rating_credibility: number | null;
  rating_elegance: number | null;
  rating_originality: number | null;
  created_at: string;
  updated_at: string;
};

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
