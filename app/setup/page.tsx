"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function SetupForm() {
  const token = useSearchParams().get("token") ?? "";
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    const response = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, userId, password }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "設定できませんでした。");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-6 space-y-4">
        <p className="text-sm text-gray-600">ユーザーIDとパスワードを設定しました。</p>
        <Link href="/login" className="text-sm text-blue-600 hover:underline">ログインする</Link>
      </div>
    );
  }

  return (
    <section className="mt-8 space-y-4">
      {!token && <p className="text-sm text-red-600">設定リンクがありません。</p>}
      <input
        className="w-full rounded border px-3 py-2 text-sm"
        placeholder="ユーザーID"
        value={userId}
        onChange={(event) => setUserId(event.target.value)}
      />
      <input
        className="w-full rounded border px-3 py-2 text-sm"
        placeholder="パスワード（10文字以上）"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button
        className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        disabled={!token || !userId.trim() || password.length < 10}
        onClick={submit}
      >
        設定する
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}

export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <h1 className="text-3xl font-bold">Account Setup</h1>
      <p className="mt-2 text-sm text-gray-500">承認メールのリンクからユーザーIDとパスワードを設定します。</p>
      <Suspense>
        <SetupForm />
      </Suspense>
    </main>
  );
}
