import { getSupabaseAdmin } from "@/lib/supabase-server";

type NoteForClassification = {
  id: string;
  title: string;
  tags: string[];
  content: string;
  category_id: string | null;
};

type CategoryForClassification = {
  id: string;
  name: string;
  parent_id: string | null;
};

export type AiClassificationResult = {
  note_id: string;
  suggested_path: string[];
  existing_category_id: string | null;
  confidence: number | null;
  reason: string | null;
};

type OpenAiAssignment = {
  note_id: string;
  suggested_path: string[];
  confidence?: number;
  reason?: string;
};

type OpenAiSuggestion = {
  suggested_title?: string;
  suggested_path: string[];
  suggested_tags?: string[];
  confidence?: number;
  reason?: string;
};

type SavedClassification = AiClassificationResult & {
  id: string;
  run_id: string;
  applied: boolean;
};

const CLASSIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          note_id: { type: "string" },
          suggested_path: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: { type: "string" },
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string" },
        },
        required: ["note_id", "suggested_path", "confidence", "reason"],
      },
    },
  },
  required: ["assignments"],
};

const SINGLE_NOTE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggested_title: {
      type: "string",
      minLength: 1,
      maxLength: 80,
    },
    suggested_path: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string" },
    },
    suggested_tags: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 30,
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" },
  },
  required: ["suggested_title", "suggested_path", "suggested_tags", "confidence", "reason"],
};

export async function suggestMetadataForNote(note: {
  title?: string;
  tags: string[];
  content: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const model = process.env.OPENAI_MODEL ?? "gpt-5.5";
  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required.");
  }

  const { data: categories, error: categoriesError } = await supabaseAdmin
    .from("categories")
    .select("id,name,parent_id")
    .order("name", { ascending: true });
  if (categoriesError) throw new Error(categoriesError.message);

  const safeCategories = (categories ?? []) as CategoryForClassification[];
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      instructions: [
        "You suggest metadata for a new personal knowledge-base note.",
        "Create a concise one-line title if the user did not provide a useful title. If a useful title exists, preserve or lightly improve it.",
        "Suggest exactly one hierarchical category path.",
        "Suggest exactly three keyword tags from the note content.",
        "Tags should be concise, searchable keywords. Do not include # symbols.",
        "Prefer existing categories when they fit. Propose a new path only when needed.",
        "Use concise category names. Use at most 4 levels.",
        "Root categories should usually be Tech, Health, Finance, Personal, Work, Travel, Sports, Music, Goods, or Other.",
        "Return only data that matches the schema.",
      ].join("\n"),
      input: JSON.stringify({
        existing_categories: safeCategories,
        note: {
          title: note.title ?? "",
          tags: note.tags,
          content: note.content.slice(0, 4000),
        },
      }),
      text: {
        format: {
          type: "json_schema",
          name: "note_category_suggestion",
          strict: true,
          schema: SINGLE_NOTE_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI API request failed: ${message}`);
  }

  const payload = await response.json();
  const parsed = parseOpenAiJson(payload) as OpenAiSuggestion;
  const suggestedPath = normalizePath(parsed.suggested_path);
  if (suggestedPath.length === 0) {
    throw new Error("OpenAI did not return a usable category suggestion.");
  }

  return {
    suggested_title: typeof parsed.suggested_title === "string" ? parsed.suggested_title.trim() : "",
    suggested_path: suggestedPath,
    suggested_tags: normalizeTags(parsed.suggested_tags),
    existing_category_id: findExistingCategoryId(safeCategories, suggestedPath),
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
    reason: parsed.reason ?? null,
  };
}

export const suggestCategoryForNote = suggestMetadataForNote;

export async function ensureCategoryPathForSuggestion(path: string[]) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: categories, error: categoriesError } = await supabaseAdmin
    .from("categories")
    .select("id,name,parent_id");
  if (categoriesError) throw new Error(categoriesError.message);

  const categoryCache = new Map<string, CategoryForClassification>();
  for (const category of (categories ?? []) as CategoryForClassification[]) {
    categoryCache.set(categoryKey(category.parent_id, category.name), category);
  }

  const leafCategory = await ensureCategoryPath(supabaseAdmin, normalizePath(path), categoryCache);
  return leafCategory;
}

export async function createClassificationRun() {
  const supabaseAdmin = getSupabaseAdmin();
  const model = process.env.OPENAI_MODEL ?? "gpt-5.5";
  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required.");
  }

  const [{ data: notes, error: notesError }, { data: categories, error: categoriesError }] = await Promise.all([
    supabaseAdmin
      .from("technical_notes")
      .select("id,title,tags,content,category_id")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("categories")
      .select("id,name,parent_id")
      .order("name", { ascending: true }),
  ]);

  if (notesError) throw new Error(notesError.message);
  if (categoriesError) throw new Error(categoriesError.message);
  if (!notes || notes.length === 0) {
    throw new Error("No notes found to classify.");
  }

  const safeNotes = (notes as NoteForClassification[]).map((note) => ({
    ...note,
    content: note.content.slice(0, 4000),
  }));
  const safeCategories = (categories ?? []) as CategoryForClassification[];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      instructions: [
        "You classify personal knowledge-base notes into a hierarchical category tree.",
        "Prefer existing categories when they fit, but propose new paths when needed.",
        "Use concise category names. Use at most 4 levels.",
        "Root categories should usually be Tech, Health, Finance, Personal, Work, Travel, or Other.",
        "Assign exactly one leaf category path per note.",
        "Return only data that matches the schema.",
      ].join("\n"),
      input: JSON.stringify({
        existing_categories: safeCategories,
        notes: safeNotes,
      }),
      text: {
        format: {
          type: "json_schema",
          name: "note_category_assignments",
          strict: true,
          schema: CLASSIFICATION_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI API request failed: ${message}`);
  }

  const payload = await response.json();
  const parsed = parseOpenAiJson(payload) as { assignments?: OpenAiAssignment[] };
  const noteIds = new Set(safeNotes.map((note) => note.id));
  const assignments = (parsed.assignments ?? [])
    .filter((assignment) => noteIds.has(assignment.note_id))
    .map((assignment) => ({
      note_id: assignment.note_id,
      suggested_path: normalizePath(assignment.suggested_path),
      existing_category_id: findExistingCategoryId(safeCategories, assignment.suggested_path),
      confidence: typeof assignment.confidence === "number" ? assignment.confidence : null,
      reason: assignment.reason ?? null,
    }))
    .filter((assignment) => assignment.suggested_path.length > 0);

  if (assignments.length === 0) {
    throw new Error("OpenAI did not return usable classifications.");
  }

  const { data: run, error: runError } = await supabaseAdmin
    .from("ai_classification_runs")
    .insert({ model, prompt_version: "v1" })
    .select("id,status,model,prompt_version,created_at,applied_at")
    .single();
  if (runError) throw new Error(runError.message);

  const rows = assignments.map((assignment) => ({
    run_id: run.id,
    ...assignment,
  }));
  const { data: classifications, error: classificationsError } = await supabaseAdmin
    .from("note_ai_classifications")
    .insert(rows)
    .select("id,run_id,note_id,suggested_path,existing_category_id,confidence,reason,applied");
  if (classificationsError) throw new Error(classificationsError.message);

  return {
    run,
    classifications: enrichClassifications((classifications ?? []) as SavedClassification[], safeNotes),
  };
}

export async function applyClassificationRun(runId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const [{ data: classifications, error: classificationsError }, { data: categories, error: categoriesError }] =
    await Promise.all([
      supabaseAdmin
        .from("note_ai_classifications")
        .select("id,run_id,note_id,suggested_path,existing_category_id,confidence,reason,applied")
        .eq("run_id", runId),
      supabaseAdmin
        .from("categories")
        .select("id,name,parent_id"),
    ]);

  if (classificationsError) throw new Error(classificationsError.message);
  if (categoriesError) throw new Error(categoriesError.message);
  if (!classifications || classifications.length === 0) {
    throw new Error("No classifications found for this run.");
  }

  const categoryCache = new Map<string, CategoryForClassification>();
  for (const category of (categories ?? []) as CategoryForClassification[]) {
    categoryCache.set(categoryKey(category.parent_id, category.name), category);
  }

  for (const classification of classifications as SavedClassification[]) {
    const leafCategory = await ensureCategoryPath(supabaseAdmin, normalizePath(classification.suggested_path), categoryCache);
    await supabaseAdmin
      .from("technical_notes")
      .update({ category_id: leafCategory.id, updated_at: new Date().toISOString() })
      .eq("id", classification.note_id);
    await supabaseAdmin
      .from("note_ai_classifications")
      .update({ existing_category_id: leafCategory.id, applied: true })
      .eq("id", classification.id);
  }

  const { data: run, error: runError } = await supabaseAdmin
    .from("ai_classification_runs")
    .update({ status: "applied", applied_at: new Date().toISOString() })
    .eq("id", runId)
    .select("id,status,model,prompt_version,created_at,applied_at")
    .single();
  if (runError) throw new Error(runError.message);

  return { run, applied_count: classifications.length };
}

function parseOpenAiJson(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "output_text" in payload) {
    const outputText = (payload as { output_text?: unknown }).output_text;
    if (typeof outputText === "string") return JSON.parse(outputText);
  }

  const response = payload as {
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  };
  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((value): value is string => typeof value === "string");

  if (!text) throw new Error("OpenAI response did not include text output.");
  return JSON.parse(text);
}

function normalizePath(path: string[]) {
  return path
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeTags(tags: unknown) {
  if (!Array.isArray(tags)) return [];

  return Array.from(new Set(
    tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.replace(/^#+/, "").trim())
      .filter(Boolean)
  )).slice(0, 3);
}

function findExistingCategoryId(categories: CategoryForClassification[], path: string[]) {
  let parentId: string | null = null;
  let current: CategoryForClassification | undefined;

  for (const part of normalizePath(path)) {
    current = categories.find(
      (category) =>
        category.parent_id === parentId &&
        category.name.toLowerCase() === part.toLowerCase()
    );
    if (!current) return null;
    parentId = current.id;
  }

  return current?.id ?? null;
}

function enrichClassifications(classifications: SavedClassification[], notes: NoteForClassification[]) {
  const noteById = new Map(notes.map((note) => [note.id, note]));
  return classifications.map((classification) => ({
    ...classification,
    note: noteById.get(classification.note_id) ?? null,
  }));
}

async function ensureCategoryPath(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  path: string[],
  categoryCache: Map<string, CategoryForClassification>
) {
  let parentId: string | null = null;
  let current: CategoryForClassification | undefined;

  for (const name of path) {
    const key = categoryKey(parentId, name);
    current = categoryCache.get(key);

    if (!current) {
      const { data, error } = await supabaseAdmin
        .from("categories")
        .insert({
          name,
          parent_id: parentId,
          ai_generated: true,
        })
        .select("id,name,parent_id")
        .single();
      if (error) throw new Error(error.message);

      current = data as CategoryForClassification;
      categoryCache.set(key, current);
    }

    parentId = current.id;
  }

  if (!current) throw new Error("Cannot apply an empty category path.");
  return current;
}

function categoryKey(parentId: string | null, name: string) {
  return `${parentId ?? "root"}:${name.trim().toLowerCase()}`;
}
