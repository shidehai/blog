"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Images,
  Tags,
  Settings2,
  LogOut,
  ArrowUpRight,
  Menu,
  X,
} from "lucide-react";
import { z } from "zod";
import { cmsPath } from "@blog/content-contracts/paths";
import { api, errorMessage } from "../lib/client";
import { Dialog } from "./Dialog";
const navigation = [
  { href: "/", label: "内容", icon: BookOpen },
  { href: "/media", label: "媒体库", icon: Images },
  { href: "/organize", label: "分类与标签", icon: Tags },
  { href: "/settings", label: "站点资料", icon: Settings2 },
];
export function StudioShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [narrow, setNarrow] = useState(false),
    [expired, setExpired] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const listener = () => setExpired(true);
    window.addEventListener("cms-session-expired", listener);
    return () => window.removeEventListener("cms-session-expired", listener);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(max-width:900px)");
    const update = () => {
      setNarrow(media.matches);
      if (!media.matches) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    update();
    media.addEventListener("change", update);
    window.addEventListener("keydown", escape);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  async function logout() {
    try {
      await api("auth/logout", z.object({ ok: z.boolean() }), "POST");
      router.push("/login");
      router.refresh();
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  return (
    <div className="studio-shell">
      <a className="skip-link" href="#studio-main">
        跳到内容
      </a>
      <header className="mobile-header">
        <Link href="/" className="wordmark">
          <span className="seal">青</span>青山写作
        </Link>
        <button
          className="icon-button"
          onClick={() => setOpen(!open)}
          aria-label={open ? "关闭导航" : "打开导航"}
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>
      {narrow && open && (
        <button
          className="sidebar-backdrop"
          aria-label="关闭导航"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        inert={narrow && !open}
        className={`studio-sidebar ${open ? "is-open" : ""}`}
      >
        <Link className="wordmark" href="/" onClick={() => setOpen(false)}>
          <span className="seal">青</span>
          <span>
            青山写作<small>个人内容工作台</small>
          </span>
        </Link>
        <nav aria-label="后台导航">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? path === "/" || path.startsWith("/write/")
                : path === href;
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                onClick={() => setOpen(false)}
                className={`sidebar-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.6} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <p>写下值得留下的。</p>
          <a
            className="sidebar-link"
            href={cmsPath("/blog")}
            target="_blank"
            rel="noreferrer"
          >
            <ArrowUpRight size={18} />
            查看博客
          </a>
          <button className="sidebar-link" onClick={logout}>
            <LogOut size={17} />
            退出登录
          </button>
          {error && <p role="alert">{error}</p>}
          <span className="owner-label">
            <span />
            仅你可见的写作空间
          </span>
        </div>
      </aside>
      <main inert={narrow && open} id="studio-main" className="studio-main">
        {children}
      </main>
      {expired && (
        <Dialog title="登录已过期" onClose={() => setExpired(false)}>
          <p>编辑内容仍保留在当前页面。请在新窗口登录后，回到这里重试保存。</p>
          <a
            className="button primary"
            href={cmsPath("/login")}
            target="_blank"
            rel="noreferrer"
          >
            重新登录
          </a>
        </Dialog>
      )}
    </div>
  );
}
