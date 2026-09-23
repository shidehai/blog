"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Folder,
  Home,
  Layers,
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        if (isOpen) onClose();
        else window.dispatchEvent(new CustomEvent("open-command-menu"));
      }
      if (event.key === "Escape" && isOpen) onClose();
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
    const normalizedQuery = query.trim().toLowerCase();
    const navItems = [
      {
        id: "nav-home",
        title: "首页",
        url: "/",
        icon: Home,
        group: "页面导航",
      },
      {
        id: "nav-tags",
        title: "标签",
        url: "/tags",
        icon: TagIcon,
        group: "页面导航",
      },
      {
        id: "nav-categories",
        title: "分类",
        url: "/categories",
        icon: Folder,
        group: "页面导航",
      },
      {
        id: "nav-archives",
        title: "归档",
        url: "/archives",
        icon: BookOpen,
        group: "页面导航",
      },
      {
        id: "nav-series",
        title: "系列专栏",
        url: "/series",
        icon: Layers,
        group: "页面导航",
      },
      {
        id: "nav-about",
        title: "关于我",
        url: "/about",
        icon: User,
        group: "页面导航",
      },
      {
        id: "nav-tools",
        title: "工具箱",
        url: "/tools",
        icon: Wrench,
        group: "页面导航",
      },
    ];

    if (!normalizedQuery) return navItems;

    const matchedNav = navItems.filter((item) =>
      item.title.toLowerCase().includes(normalizedQuery),
    );
    const matchedPosts = posts
      .filter(
        (post) =>
          post.title.toLowerCase().includes(normalizedQuery) ||
          post.summary.toLowerCase().includes(normalizedQuery) ||
          post.category.toLowerCase().includes(normalizedQuery) ||
          post.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)),
      )
      .slice(0, 5)
      .map((post) => ({
        id: `post-${post.id}`,
        title: post.title,
        url: `/archives/${post.slug}`,
        icon: BookOpen,
        group: `文章 · ${post.category}`,
      }));

    return [...matchedPosts, ...matchedNav];
  }, [posts, query]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((current) =>
        current < searchResults.length - 1 ? current + 1 : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((current) =>
        current > 0 ? current - 1 : searchResults.length - 1,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const selected = searchResults[selectedIndex];
      if (!selected) return;
      router.push(selected.url);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-menu-overlay" role="presentation">
      <div
        className="command-menu-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="站点搜索"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="command-menu-search">
          <Search className="command-menu-search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder="搜索文章、标签、分类、系列..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            autoFocus
            className="command-menu-input"
            aria-label="搜索文章、标签、分类、系列"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="command-menu-reset"
              aria-label="清空搜索"
            >
              <X aria-hidden="true" />
            </button>
          ) : (
            <kbd className="command-menu-shortcut">ESC</kbd>
          )}
        </div>

        <div className="command-menu-results">
          {searchResults.length === 0 ? (
            <p className="command-menu-empty">
              未找到与 &quot;{query}&quot; 相关的文章或页面
            </p>
          ) : (
            <ul className="command-menu-list">
              {searchResults.map((item, index) => {
                const isSelected = index === selectedIndex;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        router.push(item.url);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`command-menu-result${
                        isSelected ? " is-selected" : ""
                      }`}
                    >
                      <span className="command-menu-result-main">
                        <Icon
                          className="command-menu-result-icon"
                          aria-hidden="true"
                        />
                        <span className="command-menu-result-title">
                          {item.title}
                        </span>
                      </span>
                      <span className="command-menu-result-group">
                        {item.group}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="command-menu-footer">
          <span>↑↓ 导航 · ↵ 确认</span>
          <span>⌘K 全局搜索</span>
        </footer>
      </div>
    </div>
  );
}
