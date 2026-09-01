"use client";

import { useEffect, useState } from "react";
import type { Post, SiteProfile } from "../lib/types";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { CommandMenu } from "./CommandMenu";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

interface LayoutShellProps {
  children: React.ReactNode;
  profile: SiteProfile;
  posts: Post[];
}

export function LayoutShell({ children, profile, posts }: LayoutShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleOpen = () => setSearchOpen(true);
    window.addEventListener("open-command-menu", handleOpen);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      // '/' when not in input/textarea
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const handleScroll = () => {
      if (window.scrollY > 200) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("open-command-menu", handleOpen);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  return (
    <>
      <BackgroundCanvas />
      <Navbar onOpenSearch={() => setSearchOpen(true)} />

      <div className="page">{children}</div>

      <Footer profile={profile} />

      <CommandMenu
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        posts={posts}
      />

      {/* Floating Scroll Actions */}
      <nav
        className="scroll-actions"
        aria-label="页面滚动快捷操作"
      >
        <button
          type="button"
          onClick={scrollToTop}
          className={`scroll-action ${
            showScrollTop ? "" : "is-unavailable"
          }`}
          aria-label="回到顶部"
          title="回到顶部"
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
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={scrollToBottom}
          className="scroll-action"
          aria-label="前往底部"
          title="前往底部"
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
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </button>
      </nav>
    </>
  );
}
