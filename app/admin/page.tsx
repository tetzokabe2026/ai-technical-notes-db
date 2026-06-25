"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AdminUser = {
  id: string;
  email: string;
  user_id: string | null;
  role: "user" | "admin";
  status: "pending" | "approved" | "rejected" | "disabled";
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  last_login_at: string | null;
};

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const body = await response.json();
    if (response.status === 401) {
      window.location.assign("/login");
      throw new Error("Unauthorized");
    }
    if (response.status === 403) {
      setError("管理者権限が必要です。");
      throw new Error("Forbidden");
    }
    if (!response.ok) throw new Error(body.error ?? "Request failed.");
    return body as T;
  }

  async function loadUsers() {
    const body = await requestJson<{ users: AdminUser[] }>("/api/admin/users");
    setUsers(body.users);
  }

  useEffect(() => {
    let isMounted = true;
    async function loadInitialUsers() {
      try {
        const body = await requestJson<{ users: AdminUser[] }>("/api/admin/users");
        if (isMounted) setUsers(body.users);
      } catch (reason) {
        if (isMounted) setError(reason instanceof Error ? reason.message : "読み込みに失敗しました。");
      }
    }
    loadInitialUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  function formatDate(iso: string | null) {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });
  }

  async function runAction(user: AdminUser, action: "approve" | "reject" | "sign-out" | "password-reset" | "delete") {
    const labels = {
      approve: "承認",
      reject: user.status === "approved" ? "無効化" : "却下",
      "sign-out": "サインアウト",
      "password-reset": "パスワードリセットメール送信",
      delete: "削除",
    };
    if (!confirm(`${user.email} を${labels[action]}しますか？`)) return;

    setError("");
    setBusyId(user.id);
    try {
      if (action === "delete") {
        await requestJson(`/api/admin/users/${user.id}`, { method: "DELETE" });
      } else {
        await requestJson(`/api/admin/users/${user.id}/${action}`, { method: "POST" });
      }
      await loadUsers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作に失敗しました。");
    } finally {
      setBusyId("");
    }
  }

  function statusLabel(status: AdminUser["status"]) {
    if (status === "pending") return "申請中";
    if (status === "approved") return "承認";
    if (status === "rejected") return "却下";
    return "無効";
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin</h1>
          <p className="mt-1 text-sm text-gray-500">ユーザー申請とアカウント状態を管理します。</p>
        </div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">Back to Notes</Link>
      </header>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <section className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-3 py-2 font-semibold">メール</th>
              <th className="px-3 py-2 font-semibold">ユーザーID</th>
              <th className="px-3 py-2 font-semibold">権限</th>
              <th className="px-3 py-2 font-semibold">ステータス</th>
              <th className="px-3 py-2 font-semibold">申請日</th>
              <th className="px-3 py-2 font-semibold">最終ログイン</th>
              <th className="px-3 py-2 font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b align-top">
                <td className="px-3 py-3">{user.email}</td>
                <td className="px-3 py-3">{user.user_id ?? "-"}</td>
                <td className="px-3 py-3">{user.role}</td>
                <td className="px-3 py-3">{statusLabel(user.status)}</td>
                <td className="px-3 py-3">{formatDate(user.created_at)}</td>
                <td className="px-3 py-3">{formatDate(user.last_login_at)}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                      disabled={busyId === user.id}
                      onClick={() => runAction(user, "approve")}
                    >
                      承認
                    </button>
                    <button
                      className="rounded bg-amber-600 px-3 py-1.5 text-xs text-white hover:bg-amber-700 disabled:opacity-50"
                      disabled={busyId === user.id}
                      onClick={() => runAction(user, "reject")}
                    >
                      {user.status === "approved" ? "無効化" : "却下"}
                    </button>
                    <button
                      className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                      disabled={busyId === user.id}
                      onClick={() => runAction(user, "sign-out")}
                    >
                      サインアウト
                    </button>
                    <button
                      className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                      disabled={busyId === user.id || user.status !== "approved"}
                      onClick={() => runAction(user, "password-reset")}
                    >
                      リセット
                    </button>
                    <button
                      className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                      disabled={busyId === user.id}
                      onClick={() => runAction(user, "delete")}
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-400" colSpan={7}>ユーザーがいません。</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
