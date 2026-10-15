"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { z } from "zod";
import { api, errorMessage } from "../lib/client";
export function Login() {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="login-page">
      <div className="login-brand">
        <span className="seal">青</span>
        <span>青山写作</span>
      </div>
      <div className="login-layout">
        <div className="login-intro">
          <h1>
            一处安静的地方，
            <br />
            安放你的文字。
          </h1>
          <p>写作、整理，然后与世界分享。</p>
          <span className="login-rule" />
        </div>
        <form
          className="login-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const password = new FormData(event.currentTarget).get("password");
            setBusy(true);
            setError("");
            try {
              await api("auth/login", z.object({ ok: z.boolean() }), "POST", {
                password,
              });
              router.replace("/");
              router.refresh();
            } catch (error) {
              setError(errorMessage(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>欢迎回来</h2>
          <p>输入你的所有者密码，继续写作。</p>
          <label htmlFor="password">密码</label>
          <input
            id="password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            maxLength={256}
            autoFocus
          />
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <ArrowRight size={17} />
            )}{" "}
            {busy ? "正在登录…" : "进入写作空间"}
          </button>
          <small>忘记密码时，可在服务器运行所有者密码重置命令。</small>
        </form>
      </div>
      <footer className="login-footer">
        青山神司集 <span>文字有来处，思考有归处。</span>
      </footer>
    </main>
  );
}
