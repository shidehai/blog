"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminContentSchema,
  type AdminContent,
  type ContentDraft,
} from "@blog/content-contracts";
import { api, ApiError, errorMessage } from "../lib/client";

export function useDraft(initial: AdminContent, pendingWork = false) {
  const [item, setItem] = useState(initial),
    [draft, setDraft] = useState(initial.draft),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [issue, setIssue] = useState(""),
    [conflict, setConflict] = useState(false);
  const state = useRef({
    item: initial,
    draft: initial.draft,
    edits: 0,
    saved: 0,
    conflict: false,
  });
  const pending = useRef<Promise<AdminContent> | null>(null);
  const update = useCallback((change: Partial<ContentDraft>) => {
    const next = { ...state.current.draft, ...change };
    if (JSON.stringify(next) === JSON.stringify(state.current.draft)) return;
    state.current.draft = next;
    state.current.edits++;
    setDraft(next);
    setDirty(true);
  }, []);
  const replace = useCallback((next: AdminContent) => {
    state.current = {
      item: next,
      draft: next.draft,
      edits: 0,
      saved: 0,
      conflict: false,
    };
    setItem(next);
    setDraft(next.draft);
    setDirty(false);
    setIssue("");
    setConflict(false);
  }, []);
  const flush = useCallback(async (): Promise<AdminContent> => {
    if (pending.current) return pending.current;
    if (state.current.conflict)
      throw new Error("另一页面保存了新版本。请先处理编辑冲突。");
    if (state.current.edits === state.current.saved) return state.current.item;
    setSaving(true);
    setIssue("");
    const work = async () => {
      try {
        while (state.current.edits !== state.current.saved) {
          const sent = state.current.edits;
          const result = await api(
            `admin/contents/${state.current.item.id}`,
            adminContentSchema,
            "PUT",
            { version: state.current.item.version, draft: state.current.draft },
          );
          state.current.item = result;
          state.current.saved = sent;
          setItem(result);
          if (state.current.edits === sent) {
            state.current.draft = result.draft;
            setDraft(result.draft);
            setDirty(false);
          }
        }
        return state.current.item;
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          state.current.conflict = true;
          setConflict(true);
        }
        setIssue(errorMessage(error));
        throw error;
      } finally {
        pending.current = null;
        setSaving(false);
      }
    };
    pending.current = work();
    return pending.current;
  }, []);
  useEffect(() => {
    if (!dirty || conflict) return;
    const timer = window.setTimeout(() => void flush().catch(() => {}), 900);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, conflict, flush]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (pendingWork || state.current.edits !== state.current.saved) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const navigation = (event: MouseEvent) => {
      if (
        (!pendingWork && state.current.edits === state.current.saved) ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey
      )
        return;
      const link =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (
        link &&
        link.target !== "_blank" &&
        new URL(link.href).pathname !== window.location.pathname &&
        !window.confirm(
          "还有未保存的修改或未完成的图片任务。离开会中断当前工作，仍要离开吗？",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", leave);
    document.addEventListener("click", navigation, true);
    return () => {
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("click", navigation, true);
    };
  }, [pendingWork]);
  return {
    item,
    draft,
    dirty,
    saving,
    issue,
    conflict,
    update,
    replace,
    flush,
  };
}
