"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EVALUATION_RATING_FIELDS,
  EvaluationRatingField,
  formatRatingFieldLabel,
} from "@/lib/note-rating";
import { Category, TechnicalNote } from "@/lib/supabase";
import { APP_VERSION_LABEL } from "@/lib/version";

const EMPTY_FORM = { title: "", category_id: "", tags: "", source_url: "", content: "" };

type CategorySuggestion = {
  suggested_title: string;
  suggested_path: string[];
  suggested_tags: string[];
  existing_category_id: string | null;
  confidence: number | null;
  reason: string | null;
};

export default function Home() {
  const [notes, setNotes] = useState<TechnicalNote[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [categorySuggestion, setCategorySuggestion] = useState<CategorySuggestion | null>(null);
  const [titleSuggestionInput, setTitleSuggestionInput] = useState("");
  const [categorySuggestionInput, setCategorySuggestionInput] = useState("");
  const [tagSuggestionInput, setTagSuggestionInput] = useState("");
  const [suggestionDialogOpen, setSuggestionDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TechnicalNote | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");
  const [ratingMessage, setRatingMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<{ user_id: string | null; email: string; role: string } | null>(null);

  async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const body = await response.json();
    if (response.status === 401) {
      window.location.assign("/login");
      throw new Error("Unauthorized");
    }
    if (!response.ok) {
      throw new Error(body.error ?? "Request failed.");
    }
    return body as T;
  }

  async function fetchNotes(q = "") {
    const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    const body = await requestJson<{ notes: TechnicalNote[] }>(`/api/notes${params}`);
    setNotes(body.notes);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      const [{ user }, noteData, categoryData] = await Promise.all([
        requestJson<{ user: { user_id: string | null; email: string; role: string } | null }>("/api/auth/me"),
        requestJson<{ notes: TechnicalNote[] }>("/api/notes"),
        requestJson<{ categories: Category[] }>("/api/categories"),
      ]);

      if (!user) {
        window.location.assign("/login");
        return;
      }

      if (isMounted) {
        setCurrentUser(user);
        setNotes(noteData.notes);
        setCategories(categoryData.categories);
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleSearch() { fetchNotes(query); }
  function handleClear() { setQuery(""); fetchNotes(); }

  function parseTags(value: string) {
    return value ? value.split(",").map((t) => t.trim()).filter(Boolean) : [];
  }

  function fallbackTitleFromContent(content: string) {
    const firstLine = content
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "";

    const sentence = firstLine.split(/[。.!?]/)[0]?.trim() || firstLine;
    return sentence.length > 120 ? `${sentence.slice(0, 120)}...` : sentence;
  }

  function pathFromCategoryId(categoryId: string) {
    const path = getCategoryPath(categoryId);
    return path ? path.split(">").map((part) => part.trim()).filter(Boolean) : [];
  }

  function normalizeSuggestionPath(path: unknown) {
    return Array.isArray(path)
      ? path.filter((part): part is string => typeof part === "string").map((part) => part.trim()).filter(Boolean)
      : [];
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

  function parseConfirmedTags(value: string) {
    return normalizeTags(parseTags(value));
  }

  function fallbackTagsFromContent(content: string, title: string, categoryPath: string[]) {
    const source = `${title} ${categoryPath.join(" ")} ${content}`;
    const candidates = source
      .split(/[\s,、。.!?;:；：()[\]{}"'「」『』<>/\\|]+/)
      .map((word) => word.replace(/^#+/, "").trim())
      .filter((word) => word.length >= 2 && word.length <= 30);
    const tags = Array.from(new Set(candidates)).slice(0, 3);
    const fallbackPool = [categoryPath.at(-1), categoryPath[0], "memo", "keyword"].filter((tag): tag is string => Boolean(tag));

    for (const tag of fallbackPool) {
      if (tags.length >= 3) break;
      if (!tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) tags.push(tag);
    }

    return tags.slice(0, 3);
  }

  async function fetchCategories() {
    const body = await requestJson<{ categories: Category[] }>("/api/categories");
    setCategories(body.categories);
    return body.categories;
  }

  async function suggestNoteMetadata() {
    setError("");
    if (!form.content.trim()) {
      setError("Content is required before AI can suggest note metadata.");
      return null;
    }

    setSuggesting(true);
    let body: unknown = null;
    let response: Response;
    try {
      response = await fetch("/api/ai/suggest-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          tags: parseTags(form.tags),
          content: form.content.trim(),
        }),
      });
      body = await response.json();
    } catch {
      setSuggesting(false);
      setError("AI metadata suggestion failed. Please try Save again.");
      return null;
    }
    setSuggesting(false);

    if (!response.ok) {
      const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "AI metadata suggestion failed.";
      setError(message);
      return null;
    }

    const rawSuggestion = body as Partial<CategorySuggestion>;
    const suggestedPath = normalizeSuggestionPath(rawSuggestion.suggested_path);
    const categoryPath = suggestedPath.length > 0
      ? suggestedPath
      : form.category_id
        ? pathFromCategoryId(form.category_id)
        : ["Other"];
    const suggestedTitle = typeof rawSuggestion.suggested_title === "string"
      ? rawSuggestion.suggested_title.trim()
      : "";
    const title = form.title.trim() || suggestedTitle || fallbackTitleFromContent(form.content);
    const suggestedTags = normalizeTags(rawSuggestion.suggested_tags);
    const tags = suggestedTags.length === 3
      ? suggestedTags
      : fallbackTagsFromContent(form.content, title, categoryPath);
    const suggestion: CategorySuggestion = {
      suggested_title: title,
      suggested_path: categoryPath,
      suggested_tags: tags,
      existing_category_id: rawSuggestion.existing_category_id ?? null,
      confidence: typeof rawSuggestion.confidence === "number" ? rawSuggestion.confidence : null,
      reason: typeof rawSuggestion.reason === "string" ? rawSuggestion.reason : "AI suggested missing note metadata.",
    };
    setCategorySuggestion(suggestion);
    setTitleSuggestionInput(title);
    setCategorySuggestionInput(categoryPath.join(" > "));
    setTagSuggestionInput(tags.join(", "));
    setSuggestionDialogOpen(true);
    return suggestion;
  }

  async function saveNoteWithMetadata(title: string, categoryId: string, tags = parseTags(form.tags)) {
    setSaving(true);
    let err = "";
    let savedNote: TechnicalNote | null = null;
    try {
      const body = await requestJson<{ note: TechnicalNote }>("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category_id: categoryId,
          tags,
          content: form.content.trim(),
          source_url: form.source_url.trim() || null,
        }),
      });
      savedNote = body.note;
    } catch (reason) {
      err = reason instanceof Error ? reason.message : "Save failed.";
    }
    setSaving(false);
    if (err) { setError(err); return false; }
    setForm(EMPTY_FORM);
    setCategorySuggestion(null);
    setTitleSuggestionInput("");
    setCategorySuggestionInput("");
    setTagSuggestionInput("");
    setSuggestionDialogOpen(false);
    await fetchNotes(query);
    if (savedNote) setSelected(await ensureNoteRatings(savedNote));
    return true;
  }

  async function useSuggestedMetadata() {
    const title = titleSuggestionInput.trim();
    const suggestedPath = categorySuggestionInput
      .split(">")
      .map((part) => part.trim())
      .filter(Boolean);
    const suggestedTags = parseConfirmedTags(tagSuggestionInput);

    if (!title) {
      setError("Title is required.");
      return;
    }

    if (suggestedPath.length === 0) {
      setError("Category is required.");
      return;
    }

    if (suggestedTags.length !== 3) {
      setError("Three tags are required.");
      return;
    }

    setError("");

    const matchesOriginalSuggestion = categorySuggestion
      && categorySuggestion.suggested_path.join(">").toLowerCase() === suggestedPath.join(">").toLowerCase();

    if (matchesOriginalSuggestion && categorySuggestion.existing_category_id) {
      await saveNoteWithMetadata(title, categorySuggestion.existing_category_id, suggestedTags);
      return;
    }

    setSuggesting(true);
    const response = await fetch("/api/categories/ensure-path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: suggestedPath }),
    });
    const body = await response.json();
    setSuggesting(false);

    if (!response.ok) {
      setError(body.error ?? "Could not create suggested category.");
      return;
    }

    await fetchCategories();
    await saveNoteWithMetadata(title, body.category.id, suggestedTags);
  }

  async function handleSave() {
    setError("");
    if (!form.content.trim()) {
      setError("Content is required.");
      return;
    }
    if (!form.title.trim() || !form.category_id || parseTags(form.tags).length < 3) {
      await suggestNoteMetadata();
      return;
    }
    await saveNoteWithMetadata(form.title.trim(), form.category_id);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this note?")) return;
    await requestJson(`/api/notes/${id}`, { method: "DELETE" });
    setSelected(null);
    fetchNotes(query);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });
  }

  function getCategoryPath(categoryId: string | null) {
    if (!categoryId) return "";

    const byId = new Map(categories.map((category) => [category.id, category]));
    const path: string[] = [];
    let current = byId.get(categoryId);
    let guard = 0;

    while (current && guard < 20) {
      path.unshift(current.name);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
      guard += 1;
    }

    return path.join(" > ");
  }

  function stars(n: number) {
    return "⭐️".repeat(n);
  }

  const RATING_DB_KEYS: Record<EvaluationRatingField, keyof TechnicalNote> = {
    usefulness: "rating_usefulness",
    importance: "rating_importance",
    credibility: "rating_credibility",
  };

  function ratingValue(note: TechnicalNote, field: EvaluationRatingField): number | null {
    const value = note[RATING_DB_KEYS[field]];
    return typeof value === "number" ? value : null;
  }

  function hasRatings(note: TechnicalNote) {
    return EVALUATION_RATING_FIELDS.every((field) => ratingValue(note, field) !== null);
  }

  async function ensureNoteRatings(note: TechnicalNote) {
    if (hasRatings(note)) {
      setRatingMessage("");
      return note;
    }
    try {
      const body = await requestJson<{
        note: TechnicalNote | null;
        ratingsApplied?: boolean;
        ratingSkipReason?: string | null;
      }>(`/api/notes/${note.id}/rate`, { method: "POST" });
      if (body.note && hasRatings(body.note)) {
        setNotes((prev) => prev.map((n) => (n.id === body.note!.id ? body.note! : n)));
        setRatingMessage("");
        return body.note;
      }
      setRatingMessage(
        body.ratingSkipReason
          ? `Ratings unavailable (${body.ratingSkipReason}). Content must be 20–255 chars; check /api/debug/rating.`
          : "Ratings unavailable.",
      );
    } catch (reason) {
      console.warn("Failed to backfill note ratings:", reason);
      setRatingMessage(reason instanceof Error ? reason.message : "Failed to fetch ratings.");
    }
    return note;
  }

  async function openNote(note: TechnicalNote) {
    setRatingMessage("");
    setSelected(note);
    const rated = await ensureNoteRatings(note);
    setSelected(rated);
  }

  const categoryOptions = [...categories].sort((a, b) =>
    getCategoryPath(a.id).localeCompare(getCategoryPath(b.id))
  );

  if (selected) {
    const selectedCategoryPath = getCategoryPath(selected.category_id);

    return (
      <main className="max-w-3xl mx-auto p-6">
        <button onClick={() => setSelected(null)} className="mb-4 text-sm text-blue-600 hover:underline">
          ← Back to list
        </button>
        <h1 className="text-2xl font-bold mb-2">{selected.title}</h1>
        <div className="flex gap-3 text-sm text-gray-500 mb-4 flex-wrap">
          {selectedCategoryPath && (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-800">{selectedCategoryPath}</span>
          )}
          {selected.tags.map((t) => (
            <span key={t} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">#{t}</span>
          ))}
          <span>Created Date: {formatDate(selected.created_at)}</span>
        </div>
        {selected.source_url && (
          <a href={selected.source_url} target="_blank" rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline block mb-4">
            {selected.source_url}
          </a>
        )}
        {hasRatings(selected) ? (
          <section className="mb-4 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-semibold text-gray-700">Ratings</span>
              {EVALUATION_RATING_FIELDS.map((field) => (
                <span key={field}>
                  {formatRatingFieldLabel(field)} {stars(ratingValue(selected, field)!)}
                </span>
              ))}
            </div>
          </section>
        ) : (
          ratingMessage && (
            <p className="mb-4 text-sm text-amber-700">{ratingMessage}</p>
          )
        )}
        <pre className="mb-6 whitespace-pre-wrap rounded bg-gray-50 p-4 text-sm leading-relaxed text-gray-900">
          {selected.content}
        </pre>
        <button onClick={() => handleDelete(selected.id)}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
          Delete
        </button>
        <p
          className="fixed bottom-3 left-3 z-50 rounded bg-slate-900 px-3 py-1.5 font-mono text-xs font-semibold text-white shadow-lg"
          title="Deployed app build"
        >
          {APP_VERSION_LABEL || "build unknown"}
        </p>
      </main>
    );
  }

  return (
    <main className="relative max-w-3xl mx-auto p-6 space-y-8">
      <p
        className="fixed bottom-3 left-3 z-50 rounded bg-slate-900 px-3 py-1.5 font-mono text-xs font-semibold text-white shadow-lg"
        title="Deployed app build"
      >
        {APP_VERSION_LABEL || "build unknown"}
      </p>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">AI Technical Notes DB</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {currentUser && <span className="text-gray-500">{currentUser.user_id ?? currentUser.email}</span>}
          <Link href="/categories" className="text-blue-600 hover:underline">
            Manage Categories
          </Link>
          {currentUser?.role === "admin" && (
            <Link href="/admin" className="text-blue-600 hover:underline">
              Admin
            </Link>
          )}
          <button onClick={handleLogout} className="text-gray-600 hover:underline">
            Logout
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="flex gap-2">
        <input
          className="border rounded px-3 py-2 flex-1 text-sm"
          placeholder="Search notes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button onClick={handleSearch} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
          Search
        </button>
        <button onClick={handleClear} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">
          Clear
        </button>
      </div>

      {/* New Note Form */}
      <section>
        <h2 className="text-xl font-semibold mb-3">New Note</h2>
        <div className="space-y-3">
          <input className="border rounded px-3 py-2 w-full text-sm" placeholder="Title (AI can generate)"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select className="border rounded px-3 py-2 w-full text-sm bg-white"
            value={form.category_id} onChange={(e) => {
              setForm({ ...form, category_id: e.target.value });
              setCategorySuggestion(null);
              setTitleSuggestionInput("");
              setCategorySuggestionInput("");
              setTagSuggestionInput("");
              setSuggestionDialogOpen(false);
            }}>
            <option value="">Select category...</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>{getCategoryPath(category.id)}</option>
            ))}
          </select>
          <input className="border rounded px-3 py-2 w-full text-sm" placeholder="Tags (comma-separated)"
            value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          <input className="border rounded px-3 py-2 w-full text-sm" placeholder="Source URL"
            value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} />
          <textarea className="border rounded px-3 py-2 w-full text-sm h-32" placeholder="Content *"
            value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {saving && (
            <div className="flex items-center gap-2 text-sm text-gray-600" role="status" aria-live="polite">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
                aria-hidden="true"
              />
              <span>Saving and evaluating note…</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={handleSave} disabled={saving || suggesting}
              className="px-6 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">
              {saving ? "Saving and evaluating…" : suggesting ? "Choosing category..." : "Save"}
            </button>
          </div>
        </div>
      </section>

      {suggestionDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded bg-white p-5 shadow-lg">
            <h2 className="text-lg font-semibold">Required metadata is missing.</h2>
            <p className="mt-2 text-sm text-gray-600">
              I suggested a title, category, and three tags. Please confirm or edit them before saving.
            </p>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              Title
              <input
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                value={titleSuggestionInput}
                onChange={(event) => setTitleSuggestionInput(event.target.value)}
                placeholder="One-line title"
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              Category
              <input
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                value={categorySuggestionInput}
                onChange={(event) => setCategorySuggestionInput(event.target.value)}
                placeholder="Tech > Supabase > Security"
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              Tags
              <input
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                value={tagSuggestionInput}
                onChange={(event) => setTagSuggestionInput(event.target.value)}
                placeholder="keyword 1, keyword 2, keyword 3"
              />
            </label>
            {categorySuggestion?.reason && (
              <p className="mt-2 text-xs text-gray-500">{categorySuggestion.reason}</p>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              {saving && (
                <div className="mr-auto flex items-center gap-2 text-sm text-gray-600" role="status" aria-live="polite">
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
                    aria-hidden="true"
                  />
                  <span>Saving and evaluating note…</span>
                </div>
              )}
              <button
                className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
                onClick={() => {
                  setSuggestionDialogOpen(false);
                  setCategorySuggestion(null);
                  setTitleSuggestionInput("");
                  setCategorySuggestionInput("");
                  setTagSuggestionInput("");
                }}
              >
                Cancel
              </button>
              <button
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={
                  suggesting
                  || saving
                  || titleSuggestionInput.trim().length === 0
                  || categorySuggestionInput.trim().length === 0
                  || parseConfirmedTags(tagSuggestionInput).length !== 3
                }
                onClick={useSuggestedMetadata}
              >
                {suggesting || saving ? "Saving and evaluating…" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes List */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Notes</h2>
        {notes.length === 0 && <p className="text-gray-400 text-sm">No notes found.</p>}
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id}
              className="border rounded p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => { void openNote(note); }}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 flex-1 font-semibold">{note.title}</h3>
                {hasRatings(note) && (
                  <div className="shrink-0 max-w-[min(100%,20rem)] pt-0.5 text-[11px] leading-snug text-gray-500">
                    <div className="flex flex-wrap justify-end gap-x-2 gap-y-0.5">
                      {EVALUATION_RATING_FIELDS.map((field) => (
                        <span key={field}>
                          {formatRatingFieldLabel(field)} {stars(ratingValue(note, field)!)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                Created Date: {formatDate(note.created_at)}
              </div>
              <div className="flex gap-2 mt-1 flex-wrap">
                {getCategoryPath(note.category_id) && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800">{getCategoryPath(note.category_id)}</span>
                )}
                {note.tags.map((t) => (
                  <span key={t} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">#{t}</span>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-2">{note.content.slice(0, 200)}{note.content.length > 200 ? "…" : ""}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
