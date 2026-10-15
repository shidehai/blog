"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  Compartment,
  EditorState,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  placeholder,
  drawSelection,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
const anchorEffect = StateEffect.define<{ id: string; position?: number }>();
const anchors = StateField.define<Map<string, number>>({
  create: () => new Map(),
  update(value, transaction) {
    const next = new Map(
      [...value].map(([id, pos]) => [id, transaction.changes.mapPos(pos, 1)]),
    );
    for (const effect of transaction.effects)
      if (effect.is(anchorEffect)) {
        if (effect.value.position === undefined) next.delete(effect.value.id);
        else next.set(effect.value.id, effect.value.position);
      }
    return next;
  },
});
const editable = new Compartment();
export interface EditorHandle {
  anchor(position?: number | string): string;
  insert(text: string, anchor?: string): void;
  format(before: string, after?: string): void;
}
export const MarkdownEditor = forwardRef<
  EditorHandle,
  {
    value: string;
    onChange: (content: string) => void;
    onFiles: (files: File[], anchor: string) => void;
    disabled: boolean;
  }
>(function MarkdownEditor({ value, onChange, onFiles, disabled }, ref) {
  const host = useRef<HTMLDivElement>(null),
    view = useRef<EditorView | null>(null),
    ignore = useRef(false);
  const callbacks = useRef({ onChange, onFiles });
  useEffect(() => {
    callbacks.current = { onChange, onFiles };
  }, [onChange, onFiles]);
  useImperativeHandle(
    ref,
    () => ({
      anchor(position) {
        const editor = view.current;
        const id = crypto.randomUUID();
        if (editor)
          editor.dispatch({
            effects: anchorEffect.of({
              id,
              position:
                typeof position === "string"
                  ? editor.state.field(anchors).get(position)
                  : (position ?? editor.state.selection.main.head),
            }),
          });
        return id;
      },
      insert(text, id) {
        const editor = view.current;
        if (!editor) return;
        const position = id
          ? editor.state.field(anchors).get(id)
          : editor.state.selection.main.head;
        if (position === undefined) return;
        editor.dispatch({
          changes: { from: position, insert: text },
          ...(id ? { effects: anchorEffect.of({ id }) } : {}),
        });
        editor.focus();
      },
      format(before, after = before) {
        const editor = view.current;
        if (!editor) return;
        const { from, to } = editor.state.selection.main;
        const selected = editor.state.sliceDoc(from, to);
        editor.dispatch({
          changes: { from, to, insert: `${before}${selected}${after}` },
          selection: {
            anchor: from + before.length,
            head: from + before.length + selected.length,
          },
        });
        editor.focus();
      },
    }),
    [],
  );
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: "",
        extensions: [
          editable.of(EditorView.editable.of(true)),
          history(),
          drawSelection(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          markdown(),
          syntaxHighlighting(defaultHighlightStyle),
          EditorView.lineWrapping,
          placeholder(
            "从一个想法开始…\n\n支持 Markdown，也可以拖入图片或粘贴截图。",
          ),
          anchors,
          EditorView.contentAttributes.of({
            "aria-label": "Markdown 正文",
            spellcheck: "false",
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !ignore.current)
              callbacks.current.onChange(update.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            paste(event, editor) {
              const files = Array.from(event.clipboardData?.files ?? []).filter(
                (file) => file.type.startsWith("image/"),
              );
              if (!files.length) return false;
              event.preventDefault();
              if (!editor.state.facet(EditorView.editable)) return true;
              const id = crypto.randomUUID();
              editor.dispatch({
                effects: anchorEffect.of({
                  id,
                  position: editor.state.selection.main.head,
                }),
              });
              callbacks.current.onFiles(files, id);
              return true;
            },
            drop(event, editor) {
              const files = Array.from(event.dataTransfer?.files ?? []);
              if (!files.length) return false;
              event.preventDefault();
              if (!editor.state.facet(EditorView.editable)) return true;
              const id = crypto.randomUUID();
              editor.dispatch({
                effects: anchorEffect.of({
                  id,
                  position:
                    editor.posAtCoords({
                      x: event.clientX,
                      y: event.clientY,
                    }) ?? editor.state.selection.main.head,
                }),
              });
              callbacks.current.onFiles(files, id);
              return true;
            },
          }),
          EditorView.theme({
            "&": { fontSize: "15px", height: "100%" },
            ".cm-content": {
              fontFamily: "var(--font-mono)",
              lineHeight: "1.95",
              padding: "28px 32px",
              minHeight: "440px",
            },
            ".cm-scroller": { overflow: "auto" },
            ".cm-focused": { outline: "none" },
            ".cm-cursor": { borderLeftColor: "var(--accent)" },
            ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
              backgroundColor: "#eadbcd",
            },
            ".cm-placeholder": {
              color: "#77766e",
              fontFamily: "var(--font-sans)",
            },
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      view.current = null;
      editor.destroy();
    };
  }, []);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) {
      ignore.current = true;
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value },
      });
      ignore.current = false;
    }
  }, [value]);
  useEffect(() => {
    view.current?.dispatch({
      effects: editable.reconfigure(EditorView.editable.of(!disabled)),
    });
  }, [disabled]);
  return <div className="markdown-editor" ref={host} />;
});
