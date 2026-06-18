"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Category, supabase, TechnicalNote } from "@/lib/supabase";

const NOTE_SELECT = "*, categories(id, name)";
const EMPTY_FORM = { title: "", category_id: "", tags: "", source_url: "", content: "" };

export default function Home() {
  const [notes, setNotes] = useState<TechnicalNote[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TechnicalNote | null>(null);
  const [saving, setSaving] = useState(false);
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

  async function handleSave() {
    setError("");
    if (!form.title.trim() || !form.content.trim()) {
      setError("Title and Content are required.");
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.from("technical_notes").insert({
      title: form.title.trim(),
      category_id: form.category_id || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      content: form.content.trim(),
      source_url: form.source_url.trim() || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm(EMPTY_FORM);
    fetchNotes(query);
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
            value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">No category</option>
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
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </section>

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
