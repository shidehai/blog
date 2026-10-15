"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { z } from "zod";
const stateSchema = z.object({ generation: z.number().int().nonnegative() });
export function ContentFreshness({ generation }: { generation: number }) {
  const pathname = usePathname(),
    seen = useRef(generation);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true,
      pending = false;
    const check = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const response = await fetch("/api/content-generation", {
          cache: "no-store",
          signal: AbortSignal.timeout(7000),
        });
        if (!response.ok) throw new Error();
        const state = stateSchema.parse(await response.json());
        if (!active) return;
        setUnavailable(false);
        if (state.generation !== seen.current) {
          seen.current = state.generation;
          // A soft refresh can retain a previously rendered Next not-found boundary.
          // A new document also clears cached back/forward segments after publication.
          window.location.reload();
        }
      } catch {
        if (active) setUnavailable(true);
      } finally {
        pending = false;
      }
    };
    void check();
    window.addEventListener("focus", check);
    window.addEventListener("popstate", check);
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      window.removeEventListener("focus", check);
      window.removeEventListener("popstate", check);
      window.removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [pathname]);
  return unavailable ? (
    <div role="status" className="content-unavailable">
      暂时无法确认最新内容。请稍后刷新页面。
      <button onClick={() => window.location.reload()}>重新连接</button>
    </div>
  ) : null;
}
