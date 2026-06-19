"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Category, supabase } from "@/lib/supabase";

type CategoryWithCount = Category & {
  noteCount: number;
};

type CategoryTreeNode = CategoryWithCount & {
  children: CategoryTreeNode[];
  descendantNoteCount: number;
};

type AiClassificationPreview = {
  id: string;
  run_id: string;
  note_id: string;
  suggested_path: string[];
  existing_category_id: string | null;
  confidence: number | null;
  reason: string | null;
  applied: boolean;
  note: {
    id: string;
    title: string;
    category_id: string | null;
  } | null;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [classificationRunId, setClassificationRunId] = useState<string | null>(null);
  const [classifications, setClassifications] = useState<AiClassificationPreview[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [applying, setApplying] = useState(false);
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

    const nextCategories = (categoryData ?? []).map((category) => ({
      ...category,
      noteCount: counts.get(category.id) ?? 0,
    }));
    setCategories(nextCategories);
    setExpandedIds(new Set(nextCategories.map((category) => category.id)));
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

      const nextCategories = (categoryData ?? []).map((category) => ({
        ...category,
        noteCount: counts.get(category.id) ?? 0,
      }));
      setCategories(nextCategories);
      setExpandedIds(new Set(nextCategories.map((category) => category.id)));
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  function buildTree() {
    const nodes = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    for (const category of categories) {
      nodes.set(category.id, { ...category, children: [], descendantNoteCount: category.noteCount });
    }

    for (const node of nodes.values()) {
      if (node.parent_id && nodes.has(node.parent_id)) {
        nodes.get(node.parent_id)?.children.push(node);
      } else {
        roots.push(node);
      }
    }

    function sortAndCount(node: CategoryTreeNode) {
      node.children.sort((a, b) => a.name.localeCompare(b.name));
      node.descendantNoteCount = node.noteCount + node.children.reduce((total, child) => {
        sortAndCount(child);
        return total + child.descendantNoteCount;
      }, 0);
    }

    roots.sort((a, b) => a.name.localeCompare(b.name));
    for (const root of roots) {
      sortAndCount(root);
    }

    return roots;
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

  const categoryTree = buildTree();
  const categoryOptions = [...categories].sort((a, b) =>
    getCategoryPath(a.id).localeCompare(getCategoryPath(b.id))
  );

  function duplicateMessage(message: string) {
    return message.includes("duplicate key")
      ? "同じ階層に同じ名前のカテゴリがすでに存在します。"
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
    const { error: createError } = await supabase.from("categories").insert({
      name,
      parent_id: newParentId || null,
    });
    setSaving(false);

    if (createError) {
      setError(duplicateMessage(createError.message));
      return;
    }

    setNewName("");
    fetchCategories();
  }

  function startAddChild(categoryId: string) {
    setError("");
    setNewParentId(categoryId);
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

  async function handleDelete(category: CategoryTreeNode) {
    const confirmed = confirm(
      `カテゴリ「${getCategoryPath(category.id)}」を削除しますか？\n配下カテゴリも削除され、紐づいている技術メモ ${category.descendantNoteCount} 件のカテゴリは空白に戻ります。`
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
    if (newParentId === category.id) {
      setNewParentId("");
    }
    fetchCategories();
  }

  async function handleAutoClassify() {
    setError("");
    setClassifying(true);
    const response = await fetch("/api/ai/classify-notes", { method: "POST" });
    const body = await response.json();
    setClassifying(false);

    if (!response.ok) {
      setError(body.error ?? "AI分類に失敗しました。");
      return;
    }

    setClassificationRunId(body.run.id);
    setClassifications(body.classifications ?? []);
  }

  async function handleApplyClassification() {
    if (!classificationRunId) return;

    setError("");
    setApplying(true);
    const response = await fetch(`/api/ai/classification-runs/${classificationRunId}/apply`, {
      method: "POST",
    });
    const body = await response.json();
    setApplying(false);

    if (!response.ok) {
      setError(body.error ?? "AI分類案の適用に失敗しました。");
      return;
    }

    setClassifications((current) =>
      current.map((classification) => ({ ...classification, applied: true }))
    );
    await fetchCategories();
  }

  function toggleExpanded(categoryId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  function renderCategoryNode(node: CategoryTreeNode, depth = 0): ReactNode {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id} className="space-y-2">
        <div className="border rounded p-4" style={{ marginLeft: depth * 20 }}>
          {editingId === node.id ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className="border rounded px-3 py-2 flex-1 text-sm"
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleUpdate(node.id)}
              />
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                disabled={saving}
                onClick={() => handleUpdate(node.id)}
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
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {hasChildren ? (
                    <button
                      className="w-6 text-sm text-gray-500"
                      onClick={() => toggleExpanded(node.id)}
                      aria-label={isExpanded ? "Collapse category" : "Expand category"}
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                  ) : (
                    <span className="w-6" />
                  )}
                  <h3 className="font-semibold">{node.name}</h3>
                </div>
                <p className="text-xs text-gray-500 ml-8">
                  Direct notes: {node.noteCount} / Including children: {node.descendantNoteCount}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
                  onClick={() => startAddChild(node.id)}
                >
                  Add Child
                </button>
                <button
                  className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
                  onClick={() => startEdit(node)}
                >
                  Edit
                </button>
                <button
                  className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  onClick={() => handleDelete(node)}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
        {hasChildren && isExpanded && node.children.map((child) => renderCategoryNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Categories</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Back to Notes
        </Link>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-3">New Category</h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder="Category name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleCreate()}
          />
          <select
            className="border rounded px-3 py-2 text-sm bg-white"
            value={newParentId}
            onChange={(event) => setNewParentId(event.target.value)}
          >
            <option value="">Root category</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>{getCategoryPath(category.id)}</option>
            ))}
          </select>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
            disabled={saving}
            onClick={handleCreate}
          >
            Add
          </button>
        </div>
        {newParentId && (
          <p className="text-xs text-gray-500 mt-2">
            New child under: {getCategoryPath(newParentId)}
          </p>
        )}
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </section>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <h2 className="text-xl font-semibold">AI Classification</h2>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              disabled={classifying || applying}
              onClick={handleAutoClassify}
            >
              {classifying ? "Classifying..." : "AI Auto Classify"}
            </button>
            {classifications.length > 0 && (
              <button
                className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                disabled={applying || classifications.every((classification) => classification.applied)}
                onClick={handleApplyClassification}
              >
                {applying ? "Applying..." : "Apply All"}
              </button>
            )}
          </div>
        </div>

        {classifications.length > 0 && (
          <div className="border rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Note</th>
                  <th className="px-3 py-2 font-semibold">Current</th>
                  <th className="px-3 py-2 font-semibold">Suggested</th>
                  <th className="px-3 py-2 font-semibold">Confidence</th>
                  <th className="px-3 py-2 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {classifications.map((classification) => (
                  <tr key={classification.id} className="border-t align-top">
                    <td className="px-3 py-2 font-medium">{classification.note?.title ?? classification.note_id}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {getCategoryPath(classification.note?.category_id ?? null) || "No category"}
                    </td>
                    <td className="px-3 py-2">
                      {classification.suggested_path.join(" > ")}
                      {classification.applied && (
                        <span className="ml-2 text-xs text-green-700">Applied</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {classification.confidence === null
                        ? "-"
                        : `${Math.round(classification.confidence * 100)}%`}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{classification.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Category Tree</h2>
        {categoryTree.length === 0 && <p className="text-gray-400 text-sm">No categories found.</p>}
        <div className="space-y-3">
          {categoryTree.map((node) => renderCategoryNode(node))}
        </div>
      </section>
    </main>
  );
}
