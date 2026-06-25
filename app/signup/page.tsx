"use client";

import Link from "next/link";
import { useState } from "react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "申請できませんでした。");
      return;
    }
    setDone(true);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <h1 className="text-3xl font-bold">Sign Up</h1>
      {done ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-gray-600">
            申請を受け付けました。管理者の承認後、結果をメールで通知します。
          </p>
          <Link href="/login" className="text-sm text-blue-600 hover:underline">ログインへ戻る</Link>
        </div>
      ) : (
        <section className="mt-8 space-y-4">
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="メールアドレス"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && submit()}
          />
          <button
            className="w-full rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            disabled={!email.trim()}
            onClick={submit}
          >
            申請する
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Link href="/login" className="block text-sm text-blue-600 hover:underline">ログインへ戻る</Link>
        </section>
      )}
    </main>
  );
}
