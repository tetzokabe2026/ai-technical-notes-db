"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [hashTokens, setHashTokens] = useState({ code: "", accessToken: "", refreshToken: "", tokenHash: "" });
  const code = searchParams.get("code") ?? hashTokens.code;
  const accessToken = hashTokens.accessToken;
  const refreshToken = hashTokens.refreshToken;
  const tokenHash = searchParams.get("token_hash") ?? hashTokens.tokenHash;
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const hasResetToken = Boolean(code || tokenHash || (accessToken && refreshToken));

  useEffect(() => {
    queueMicrotask(() => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      setHashTokens({
        code: hashParams.get("code") ?? "",
        accessToken: hashParams.get("access_token") ?? "",
        refreshToken: hashParams.get("refresh_token") ?? "",
        tokenHash: hashParams.get("token_hash") ?? "",
      });
      setMounted(true);
    });
  }, []);

  async function submit() {
    setError("");
    setLoading(true);
    const response = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, accessToken, refreshToken, tokenHash, password }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(body.error ?? "パスワードを更新できませんでした。");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-6 space-y-4">
        <p className="text-sm text-gray-600">パスワードを更新しました。</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">アプリを開く</Link>
      </div>
    );
  }

  return (
    <section className="mt-8 space-y-4">
      {!mounted && <p className="text-sm text-gray-500">リセットリンクを確認しています...</p>}
      {mounted && !hasResetToken && <p className="text-sm text-red-600">リセットリンクがありません。</p>}
      <div className="relative">
        <input
          className="w-full rounded border px-3 py-2 pr-11 text-sm"
          placeholder="新しいパスワード（10文字以上）"
          type={passwordVisible ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && submit()}
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
        disabled={!hasResetToken || loading || password.length < 10}
        onClick={submit}
      >
        {loading ? "更新中..." : "パスワードを更新"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <h1 className="text-3xl font-bold">Reset Password</h1>
      <p className="mt-2 text-sm text-gray-500">メールのリンクから新しいパスワードを設定します。</p>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
