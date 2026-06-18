"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Category, supabase } from "@/lib/supabase";

type CategoryWithCount = Category & {
  noteCount: number;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchCategories() {
    const [{ data: categoryData }, { data: noteData }] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true }),
      supabase
        .from("technical_notes")
        .select("category_id"),
    ]);

    const counts = new Map<string, number>();
    for (const note of noteData ?? []) {
      if (note.category_id) {
        counts.set(note.category_id, (counts.get(note.category_id) ?? 0) + 1);
      }
    }

    setCategories(
      (categoryData ?? []).map((category) => ({
        ...category,
        noteCount: counts.get(category.id) ?? 0,
      }))
    );
  }

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      const [{ data: categoryData }, { data: noteData }] = await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .order("name", { ascending: true }),
        supabase
          .from("technical_notes")
          .select("category_id"),
      ]);

      if (!isMounted) return;

      const counts = new Map<string, number>();
      for (const note of noteData ?? []) {
        if (note.category_id) {
          counts.set(note.category_id, (counts.get(note.category_id) ?? 0) + 1);
        }
      }

      setCategories(
        (categoryData ?? []).map((category) => ({
          ...category,
          noteCount: counts.get(category.id) ?? 0,
        }))
      );
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  function duplicateMessage(message: string) {
    return message.includes("duplicate key")
      ? "同じ名前のカテゴリがすでに存在します。"
      : message;
  }

  async function handleCreate() {
    const name = newName.trim();
    setError("");
    if (!name) {
      setError("カテゴリ名を入力してください。");
      return;
    }

    setSaving(true);
    const { error: createError } = await supabase.from("categories").insert({ name });
    setSaving(false);

    if (createError) {
      setError(duplicateMessage(createError.message));
      return;
    }

    setNewName("");
    fetchCategories();
  }

  function startEdit(category: CategoryWithCount) {
    setError("");
    setEditingId(category.id);
    setEditingName(category.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function handleUpdate(categoryId: string) {
    const name = editingName.trim();
    setError("");
    if (!name) {
      setError("カテゴリ名を入力してください。");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from("categories")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", categoryId);
    setSaving(false);

    if (updateError) {
      setError(duplicateMessage(updateError.message));
      return;
    }

    cancelEdit();
    fetchCategories();
  }

  async function handleDelete(category: CategoryWithCount) {
    const confirmed = confirm(
      `カテゴリ「${category.name}」を削除しますか？\n紐づいている技術メモ ${category.noteCount} 件のカテゴリは空白に戻ります。`
    );
    if (!confirmed) return;

    setError("");
    const { error: deleteError } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingId === category.id) {
      cancelEdit();
    }
    fetchCategories();
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Categories</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Back to Notes
        </Link>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-3">New Category</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="border rounded px-3 py-2 flex-1 text-sm"
            placeholder="Category name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleCreate()}
          />
          <button
            className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
            disabled={saving}
            onClick={handleCreate}
          >
            Add
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Category List</h2>
        {categories.length === 0 && <p className="text-gray-400 text-sm">No categories found.</p>}
        <div className="space-y-3">
          {categories.map((category) => (
            <div key={category.id} className="border rounded p-4">
              {editingId === category.id ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    className="border rounded px-3 py-2 flex-1 text-sm"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && handleUpdate(category.id)}
                  />
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    disabled={saving}
                    onClick={() => handleUpdate(category.id)}
                  >
                    Save
                  </button>
                  <button
                    className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold">{category.name}</h3>
                    <p className="text-xs text-gray-500">Notes: {category.noteCount}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
                      onClick={() => startEdit(category)}
                    >
                      Edit
                    </button>
                    <button
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      onClick={() => handleDelete(category)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
