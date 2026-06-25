"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState("");
  const [resetError, setResetError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function submitLogin() {
    setError("");
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(body.error ?? "ログインできませんでした。");
      return;
    }
    window.location.href = "/";
  }

  async function submitReset() {
    setResetError("");
    setResetSent(false);
    setResetLoading(true);
    const response = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetEmail }),
    });
    const body = await response.json();
    setResetLoading(false);
    if (!response.ok) {
      setResetError(body.error ?? "リセットメールを送信できませんでした。");
      return;
    }
    setResetSent(true);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <h1 className="text-3xl font-bold">AI Technical Notes DB</h1>
      <p className="mt-2 text-sm text-gray-500">Supabase Authのメールアドレスとパスワードでログインします。</p>

      <section className="mt-8 space-y-4">
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="メールアドレス"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <div className="relative">
          <input
            className="w-full rounded border px-3 py-2 pr-11 text-sm"
            placeholder="パスワード"
            type={passwordVisible ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && submitLogin()}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-sm text-gray-500 hover:text-gray-800"
            aria-label={passwordVisible ? "パスワードを隠す" : "パスワードを表示"}
            title={passwordVisible ? "パスワードを隠す" : "パスワードを表示"}
            onClick={() => setPasswordVisible((current) => !current)}
          >
            {passwordVisible ? "◉" : "◎"}
          </button>
        </div>
        <button
          className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={loading || !email.trim() || !password}
          onClick={submitLogin}
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <button
          className="text-blue-600 hover:underline"
          onClick={() => {
            setResetOpen((current) => !current);
            setResetEmail(email);
            setResetError("");
            setResetSent(false);
          }}
        >
          パスワードをリセット
        </button>
        <Link href="/signup" className="text-blue-600 hover:underline">
          アカウント申請はこちら
        </Link>
      </div>

      {resetOpen && (
        <section className="mt-5 space-y-3 border-t pt-5">
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="リセットするメールアドレス"
            type="email"
            value={resetEmail}
            onChange={(event) => setResetEmail(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && submitReset()}
          />
          <button
            className="w-full rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            disabled={resetLoading || !resetEmail.trim()}
            onClick={submitReset}
          >
            {resetLoading ? "送信中..." : "リセットメールを送信"}
          </button>
          {resetSent && <p className="text-sm text-green-700">リセットメールを送信しました。</p>}
          {resetError && <p className="text-sm text-red-600">{resetError}</p>}
        </section>
      )}
    </main>
  );
}
