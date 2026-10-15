"use client";
import { useState } from "react";
import { Plus, Pencil, Tags, Check } from "lucide-react";
import { taxonomySchema, type Taxonomy } from "@blog/content-contracts";
import { slugify } from "@blog/markdown";
import { api, errorMessage } from "../lib/client";
import { Dialog } from "./Dialog";
const labels = { category: "分类", tag: "标签", series: "系列" };
export function Organize({ initial }: { initial: Taxonomy[] }) {
  const [items, setItems] = useState(initial),
    [kind, setKind] = useState<Taxonomy["kind"]>("category"),
    [editing, setEditing] = useState<Taxonomy | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="content-page narrow-page">
      <header className="page-heading">
        <div>
          <h1>整理你的内容</h1>
          <p>分类收拢主题，标签连接想法，系列串起完整的故事。</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setError("");
            setEditing({
              id: crypto.randomUUID(),
              kind,
              name: "",
              slug: "",
              description: "",
            });
          }}
        >
          <Plus size={17} />
          新建{labels[kind]}
        </button>
      </header>
      <div className="filter-tabs organize-tabs">
        {Object.entries(labels).map(([value, label]) => (
          <button
            key={value}
            className={kind === value ? "active" : ""}
            aria-pressed={kind === value}
            onClick={() => setKind(taxonomySchema.shape.kind.parse(value))}
          >
            {label}
            <span>{items.filter((item) => item.kind === value).length}</span>
          </button>
        ))}
      </div>
      <div className="taxonomy-list">
        {items
          .filter((item) => item.kind === kind)
          .map((item) => (
            <button
              className="taxonomy-row"
              key={item.id}
              onClick={() => {
                setError("");
                setEditing(item);
              }}
            >
              <div>
                <h2>{item.name}</h2>
                <p>{item.description || `/${item.slug}`}</p>
              </div>
              <span>/{item.slug}</span>
              <Pencil size={16} />
            </button>
          ))}
        {!items.some((item) => item.kind === kind) && (
          <div className="empty-state">
            <Tags size={34} strokeWidth={1.2} />
            <h2>给内容一个归处</h2>
            <p>添加第一个{labels[kind]}，写作时便能选用。</p>
          </div>
        )}
      </div>
      <p className="field-help">
        保存名称或介绍后，博客上的相关展示会直接更新。文章归属在发布时生效。
      </p>
      {editing && (
        <Dialog
          title={`${items.some((item) => item.id === editing.id) ? "编辑" : "新建"}${labels[editing.kind]}`}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                const saved = await api(
                  "admin/taxonomies",
                  taxonomySchema,
                  "PUT",
                  editing,
                );
                setItems((items) => [
                  ...items.filter((item) => item.id !== saved.id),
                  saved,
                ]);
                setEditing(null);
              } catch (error) {
                setError(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              名称
              <input
                required
                maxLength={120}
                value={editing.name}
                autoFocus
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
                onBlur={() => {
                  if (!editing.slug)
                    setEditing({ ...editing, slug: slugify(editing.name) });
                }}
              />
            </label>
            <label>
              地址
              <input
                required
                maxLength={180}
                value={editing.slug}
                onChange={(e) =>
                  setEditing({ ...editing, slug: e.target.value })
                }
              />
            </label>
            <label>
              介绍
              <textarea
                rows={4}
                maxLength={2000}
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </label>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              <Check size={16} />
              {busy ? "正在保存…" : "保存并更新博客"}
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
