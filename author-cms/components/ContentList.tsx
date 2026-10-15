"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  ArrowUpRight,
  FileText,
  LoaderCircle,
  PenLine,
} from "lucide-react";
import {
  adminContentSchema,
  type AdminContent,
  type ContentDraft,
} from "@blog/content-contracts";
import { api, dateLabel, errorMessage, kindLabels } from "../lib/client";
const status = (item: AdminContent) =>
  item.archived ? "archived" : item.publishedRevisionId ? "published" : "draft";
export function ContentList({ initial }: { initial: AdminContent[] }) {
  const router = useRouter();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [kind, setKind] = useState<ContentDraft["kind"]>("article"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const filtered = useMemo(
    () =>
      initial.filter(
        (item) =>
          (filter === "all" || status(item) === filter) &&
          `${item.draft.title} ${item.draft.summary} ${item.draft.slug}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [initial, filter, query],
  );
  async function create() {
    setBusy(true);
    setError("");
    try {
      const item = await api("admin/contents", adminContentSchema, "POST", {
        kind,
      });
      router.push(`/write/${item.id}`);
    } catch (error) {
      setError(errorMessage(error));
      setBusy(false);
    }
  }
  return (
    <div className="content-page">
      <header className="page-heading">
        <div>
          <h1>你的文字</h1>
          <p>让零散的想法，成为有迹可循的记录。</p>
        </div>
        <div className="create-actions">
          <select
            aria-label="新建内容类型"
            value={kind}
            onChange={(e) => setKind(e.target.value as ContentDraft["kind"])}
          >
            {Object.entries(kindLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button className="button primary" onClick={create} disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Plus size={18} />
            )}
            写一篇{kindLabels[kind]}
          </button>
        </div>
      </header>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="list-toolbar">
        <div className="filter-tabs" aria-label="内容状态">
          {[
            ["all", "全部"],
            ["draft", "草稿"],
            ["published", "已发布"],
            ["archived", "已归档"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "active" : ""}
              aria-pressed={filter === value}
              onClick={() => setFilter(value!)}
            >
              {label}
              <span>
                {
                  initial.filter(
                    (item) => value === "all" || status(item) === value,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={17} />
          <input
            type="search"
            placeholder="搜索标题或文章地址"
            aria-label="搜索内容"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="content-table">
        <div className="content-table-labels">
          <span>内容</span>
          <span>状态</span>
          <span>最近编辑</span>
          <span />
        </div>
        {filtered.map((item) => (
          <Link
            className="content-row"
            href={`/write/${item.id}`}
            prefetch={false}
            key={item.id}
          >
            <div className="row-title">
              <div
                className={`row-thumbnail ${item.draft.coverId ? "has-cover" : ""}`}
              >
                {item.draft.coverId ? (
                  <img
                    src={`/api/admin/media/${item.draft.coverId}`}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <FileText size={24} strokeWidth={1.3} />
                )}
              </div>
              <div>
                <span className="content-kind">
                  {kindLabels[item.draft.kind]}
                </span>
                <h2>{item.draft.title || "未命名的草稿"}</h2>
                <p>
                  {item.draft.summary ||
                    item.draft.content.replace(/[#*`>]/g, "").slice(0, 90) ||
                    "还没有正文，随时开始。"}
                </p>
              </div>
            </div>
            <div>
              <span className={`status-badge ${status(item)}`}>
                {item.archived
                  ? "已归档"
                  : item.publishedRevisionId
                    ? "已发布"
                    : "草稿"}
              </span>
              {item.publishedRevisionId &&
                item.draftRevisionId !== item.publishedRevisionId && (
                  <small className="draft-change">有草稿修改</small>
                )}
            </div>
            <time dateTime={item.updatedAt}>{dateLabel(item.updatedAt)}</time>
            <ArrowUpRight className="row-arrow" size={18} />
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <PenLine size={36} strokeWidth={1.2} />
            <h2>
              {query
                ? "没有找到相关内容"
                : filter === "all"
                  ? "从第一段文字开始"
                  : "这里还没有内容"}
            </h2>
            <p>
              {query
                ? "试试其他标题或地址。"
                : "不急着写完，草稿会为你留在这里。"}
            </p>
            {filter === "all" && !query && (
              <button className="button" onClick={create} disabled={busy}>
                <Plus size={16} />
                开始写作
              </button>
            )}
          </div>
        )}
      </div>
      <footer className="list-footer">
        <span>{filtered.length} 篇内容</span>
        <span>草稿仅你可见 · 发布后直接更新博客</span>
      </footer>
    </div>
  );
}
