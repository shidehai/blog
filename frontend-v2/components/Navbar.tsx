"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavbarProps {
  onOpenSearch?: () => void;
}

/** globals.css 的变量只以 data-theme 为主题来源。 */
function applyTheme(mode: "system" | "light" | "dark"): boolean {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.setAttribute("data-theme", dark ? "dark" : "light");
  return dark;
}

const NAV_LINKS = [
  { href: "/", label: "首页" },
  { href: "/categories", label: "分类" },
  { href: "/series", label: "系列" },
  { href: "/archives", label: "归档" },
  { href: "/tags", label: "标签" },
  { href: "/tools", label: "工具箱" },
  { href: "/about", label: "关于" },
];

export function Navbar({ onOpenSearch }: NavbarProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark">(
    "system",
  );
  const [isDark, setIsDark] = useState(false);
  const [searchVal, setSearchVal] = useState("");

  // 路由变化时收起抽屉与主题菜单：渲染期间按 props 调整状态，
  // 避免 effect 里同步 setState 的级联渲染（react-hooks/set-state-in-effect）。
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setDrawerOpen(false);
    setThemeMenuOpen(false);
  }

  // 恢复已保存的偏好；无保存值时跟随系统，并随系统变化更新。
  // localStorage 只能在客户端挂载后读取（否则水合不匹配），这里从外部系统
  // 同步初始主题是有意为之，故豁免 set-state-in-effect。
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const mode = saved === "light" || saved === "dark" ? saved : "system";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeMode(mode);
    setIsDark(applyTheme(mode));

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!localStorage.getItem("theme")) setIsDark(applyTheme("system"));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const selectTheme = (mode: "system" | "light" | "dark") => {
    setThemeMode(mode);
    setThemeMenuOpen(false);
    setIsDark(applyTheme(mode));
    if (mode === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", mode);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenSearch?.();
  };

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          {/* Logo */}
          <Link href="/" className="nav-logo">
            <svg
              className="ui-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <g
                transform="translate(-2.614,-3.84) scale(0.278)"
                strokeWidth="6"
              >
                <path d="M50 56 C40 44 26 34 14 30 C26 40 34 46 42 52 C30 54 20 60 13 70 C26 63 37 60 47 60 C52 60 56 59 60 57 Z" />
                <path d="M55 57 C58 50 63 42 72 37 C76 35 82 33 88 33 L92 30 C88 31 84 32 80 34 C71 39 63 47 58 55 Z" />
              </g>
            </svg>
            青山神司集
          </Link>

          {/* Links */}
          <ul className="nav-links">
            {NAV_LINKS.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={isActive ? "active" : ""}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Right Actions */}
          <div className="nav-actions">
            <form className="nav-search" onSubmit={handleSearch} role="search">
              <svg
                className="ui-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
              <input
                type="search"
                name="q"
                placeholder="搜索…"
                aria-label="搜索文章"
                autoComplete="off"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                onClick={() => onOpenSearch?.()}
              />
            </form>

            <div className="theme-control">
              <button
                type="button"
                className="theme-menu-btn"
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                aria-label={`主题：${themeMode}`}
                aria-expanded={themeMenuOpen}
              >
                {isDark ? (
                  <svg
                    className="ui-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8z" />
                  </svg>
                ) : (
                  <svg
                    className="ui-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                  </svg>
                )}
              </button>

              {themeMenuOpen && (
                <div className="theme-menu" role="menu">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={themeMode === "light"}
                    onClick={() => selectTheme("light")}
                  >
                    <svg
                      className="ui-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                    </svg>
                    <span>亮色</span>
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={themeMode === "dark"}
                    onClick={() => selectTheme("dark")}
                  >
                    <svg
                      className="ui-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8z" />
                    </svg>
                    <span>暗色</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="nav-toggle"
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-label="菜单"
              aria-expanded={drawerOpen}
            >
              <svg
                className="ui-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        <div id="reading-progress" aria-hidden="true"></div>
      </nav>

      {/* Mobile Drawer */}
      <div
        className={`drawer-overlay ${drawerOpen ? "open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      ></div>
      <aside className={`mobile-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="drawer-head">
          <span id="mobile-menu-title">青山神司集</span>
          <button
            type="button"
            className="drawer-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="关闭"
          >
            <svg
              className="ui-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <p className="drawer-eyebrow">浏览内容</p>
        <ul className="drawer-nav">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link href={link.href} className={isActive ? "active" : ""}>
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}
