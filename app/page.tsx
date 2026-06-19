"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Category, supabase, TechnicalNote } from "@/lib/supabase";

const NOTE_SELECT = "*, categories(id, name)";
const EMPTY_FORM = { title: "", category_id: "", tags: "", source_url: "", content: "" };

type CategorySuggestion = {
  suggested_path: string[];
  existing_category_id: string | null;
  confidence: number | null;
  reason: string | null;
};

export default function Home() {
  const [notes, setNotes] = useState<TechnicalNote[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [categorySuggestion, setCategorySuggestion] = useState<CategorySuggestion | null>(null);
  const [categorySuggestionInput, setCategorySuggestionInput] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TechnicalNote | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");

  async function fetchNotes(q = "") {
    let req = supabase
      .from("technical_notes")
      .select(NOTE_SELECT)
      .order("created_at", { ascending: false });

    const trimmedQuery = q.trim();
    if (trimmedQuery) {
      const { data: matchingCategories } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", `%${trimmedQuery}%`);
      const categoryIds = matchingCategories?.map((category) => category.id) ?? [];
      const categoryFilter = categoryIds.length > 0
        ? `,category_id.in.(${categoryIds.join(",")})`
        : "";

      req = req.or(`title.ilike.%${trimmedQuery}%,content.ilike.%${trimmedQuery}%${categoryFilter}`);
    }

    const { data } = await req;
    setNotes(data ?? []);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      const [{ data: noteData }, { data: categoryData }] = await Promise.all([
        supabase
          .from("technical_notes")
          .select(NOTE_SELECT)
          .order("created_at", { ascending: false }),
        supabase
          .from("categories")
          .select("*")
          .order("name", { ascending: true }),
      ]);

      if (isMounted) {
        setNotes(noteData ?? []);
        setCategories(categoryData ?? []);
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

  async function fetchCategories() {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });
    setCategories(data ?? []);
    return data ?? [];
  }

  async function suggestCategory() {
    setError("");
    if (!form.title.trim() || !form.content.trim()) {
      setError("Title and Content are required before AI can suggest a category.");
      return null;
    }

    setSuggesting(true);
    const response = await fetch("/api/ai/suggest-category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        tags: parseTags(form.tags),
        content: form.content.trim(),
      }),
    });
    const body = await response.json();
    setSuggesting(false);

    if (!response.ok) {
      setError(body.error ?? "AI category suggestion failed.");
      return null;
    }

    const suggestion = body as CategorySuggestion;
    setCategorySuggestion(suggestion);
    setCategorySuggestionInput(suggestion.suggested_path.join(" > "));
    setCategoryDialogOpen(true);
    return suggestion;
  }

  async function saveNoteWithCategory(categoryId: string) {
    setSaving(true);
    const { error: err } = await supabase.from("technical_notes").insert({
      title: form.title.trim(),
      category_id: categoryId,
      tags: parseTags(form.tags),
      content: form.content.trim(),
      source_url: form.source_url.trim() || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return false; }
    setForm(EMPTY_FORM);
    setCategorySuggestion(null);
    setCategorySuggestionInput("");
    setCategoryDialogOpen(false);
    fetchNotes(query);
    return true;
  }

  async function useSuggestedCategoryPath() {
    const suggestedPath = categorySuggestionInput
      .split(">")
      .map((part) => part.trim())
      .filter(Boolean);

    if (suggestedPath.length === 0) {
      setError("Category is required.");
      return;
    }

    setError("");

    const matchesOriginalSuggestion = categorySuggestion
      && categorySuggestion.suggested_path.join(">").toLowerCase() === suggestedPath.join(">").toLowerCase();

    if (matchesOriginalSuggestion && categorySuggestion.existing_category_id) {
      await saveNoteWithCategory(categorySuggestion.existing_category_id);
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
    await saveNoteWithCategory(body.category.id);
  }

  async function handleSave() {
    setError("");
    if (!form.title.trim() || !form.content.trim()) {
      setError("Title and Content are required.");
      return;
    }
    if (!form.category_id) {
      await suggestCategory();
      return;
    }
    await saveNoteWithCategory(form.category_id);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this note?")) return;
    await supabase.from("technical_notes").delete().eq("id", id);
    setSelected(null);
    fetchNotes(query);
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
          {selectedCategoryPath && <span className="bg-gray-100 px-2 py-0.5 rounded">{selectedCategoryPath}</span>}
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
        <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded text-sm leading-relaxed mb-6">
          {selected.content}
        </pre>
        <button onClick={() => handleDelete(selected.id)}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
          Delete
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">AI Technical Notes DB</h1>
        <Link href="/categories" className="text-sm text-blue-600 hover:underline">
          Manage Categories
        </Link>
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
          <input className="border rounded px-3 py-2 w-full text-sm" placeholder="Title *"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select className="border rounded px-3 py-2 w-full text-sm bg-white"
            value={form.category_id} onChange={(e) => {
              setForm({ ...form, category_id: e.target.value });
              setCategorySuggestion(null);
              setCategorySuggestionInput("");
              setCategoryDialogOpen(false);
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
          <div className="flex flex-wrap gap-2">
            <button onClick={handleSave} disabled={saving || suggesting}
              className="px-6 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">
              {saving ? "Saving..." : suggesting ? "Choosing category..." : "Save"}
            </button>
          </div>
        </div>
      </section>

      {categoryDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded bg-white p-5 shadow-lg">
            <h2 className="text-lg font-semibold">Category is not selected.</h2>
            <p className="mt-2 text-sm text-gray-600">
              Do you wish me to select for you?
            </p>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              Category
              <input
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                value={categorySuggestionInput}
                onChange={(event) => setCategorySuggestionInput(event.target.value)}
                placeholder="Tech > Supabase > Security"
              />
            </label>
            {categorySuggestion?.reason && (
              <p className="mt-2 text-xs text-gray-500">{categorySuggestion.reason}</p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
                onClick={() => {
                  setCategoryDialogOpen(false);
                  setCategorySuggestion(null);
                  setCategorySuggestionInput("");
                }}
              >
                Cancel
              </button>
              <button
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={suggesting || categorySuggestionInput.trim().length === 0}
                onClick={useSuggestedCategoryPath}
              >
                {suggesting || saving ? "Saving..." : "OK"}
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
              onClick={() => setSelected(note)}>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-start">
                <h3 className="font-semibold">{note.title}</h3>
                <span className="text-xs text-gray-400 sm:ml-4 shrink-0">
                  Created Date: {formatDate(note.created_at)}
                </span>
              </div>
              <div className="flex gap-2 mt-1 flex-wrap">
                {getCategoryPath(note.category_id) && (
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{getCategoryPath(note.category_id)}</span>
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
