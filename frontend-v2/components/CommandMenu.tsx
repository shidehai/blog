"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Folder,
  Home,
  Layers,
  PenLine,
  Search,
  Tag as TagIcon,
  User,
  Wrench,
  X,
} from "lucide-react";
import type { Post } from "../lib/types";

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  posts: Post[];
}

export function CommandMenu({ isOpen, onClose, posts }: CommandMenuProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          const event = new CustomEvent("open-command-menu");
          window.dispatchEvent(event);
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();

    const navItems = [
      { id: "nav-home", title: "首页", url: "/", icon: Home, group: "页面导航" },
      { id: "nav-writing", title: "文章归档", url: "/writing", icon: BookOpen, group: "页面导航" },
      { id: "nav-notes", title: "随记与备忘", url: "/notes", icon: PenLine, group: "页面导航" },
      { id: "nav-topics", title: "专题分类", url: "/topics", icon: Layers, group: "页面导航" },
      { id: "nav-tags", title: "标签", url: "/tags", icon: TagIcon, group: "页面导航" },
      { id: "nav-categories", title: "分类", url: "/categories", icon: Folder, group: "页面导航" },
      { id: "nav-archives", title: "归档", url: "/archives", icon: BookOpen, group: "页面导航" },
      { id: "nav-series", title: "系列专栏", url: "/series", icon: Layers, group: "页面导航" },
      { id: "nav-about", title: "关于我", url: "/about", icon: User, group: "页面导航" },
      { id: "nav-tools", title: "工具箱", url: "/tools", icon: Wrench, group: "页面导航" },
    ];

    if (!q) {
      return navItems;
    }

    const matchedNav = navItems.filter((item) =>
      item.title.toLowerCase().includes(q),
    );

    const matchedPosts = posts
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.summary?.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .slice(0, 5)
      .map((p) => ({
        id: `post-${p.id}`,
        title: p.title,
        url: `/writing/${p.slug}`,
        icon: BookOpen,
        group: `文章 · ${p.category}`,
      }));

    return [...matchedPosts, ...matchedNav];
  }, [query, posts]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < searchResults.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : searchResults.length - 1,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = searchResults[selectedIndex];
      if (selected) {
        router.push(selected.url);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 bg-black/50 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-[var(--bg-card-solid)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)] bg-[var(--bg-card)]">
          <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          <input
            type="text"
            placeholder="搜索文章、标签、分类、系列..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 border border-[var(--border)] rounded text-[var(--text-muted)]">
              ESC
            </kbd>
          )}
        </div>

        {/* Results */}
        <div className="overflow-y-auto p-2 divide-y divide-[var(--border-card)]">
          {searchResults.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              未找到与 &quot;{query}&quot; 相关的文章或页面
            </div>
          ) : (
            <ul className="space-y-1 py-1">
              {searchResults.map((item, index) => {
                const isSelected = index === selectedIndex;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        router.push(item.url);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-xs sm:text-sm transition-colors ${
                        isSelected
                          ? "bg-[var(--accent)] text-[var(--on-accent)] font-medium"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                          isSelected
                            ? "bg-black/20 text-white"
                            : "bg-[var(--tag-bg)] text-[var(--tag-text)]"
                        }`}
                      >
                        {item.group}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span>↑↓ 导航</span>
            <span>↵ 确认</span>
          </div>
          <span>⌘K 全局搜索</span>
        </div>
      </div>
    </div>
  );
}
