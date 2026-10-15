"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowUpRight,
  Bold,
  Italic,
  Heading2,
  List,
  Code2,
  ImagePlus,
  Images,
  History,
  SlidersHorizontal,
  Check,
  LoaderCircle,
  CloudOff,
  Upload,
  Archive,
  X,
} from "lucide-react";
import {
  adminContentSchema,
  publicationSchema,
  draftSchema,
  type AdminContent,
  type Media,
  type Taxonomy,
} from "@blog/content-contracts";
import { MarkdownContent } from "@blog/markdown/react";
import { deriveReadingMinutes, deriveWordCount, slugify } from "@blog/markdown";
import {
  api,
  ApiError,
  dateLabel,
  errorMessage,
  kindLabels,
  uploadImage,
} from "../lib/client";
import { MarkdownEditor, type EditorHandle } from "./MarkdownEditor";
import { useDraft } from "./useDraft";
import { MediaPicker } from "./MediaLibrary";
import { Dialog } from "./Dialog";
const historySchema = z.array(
  z.object({
    id: z.uuid(),
    data: draftSchema,
    source: z.string(),
    createdAt: z.string(),
  }),
);
type UploadJob = {
  id: string;
  file: File;
  anchor: string;
  progress: number;
  error: string;
  done: boolean;
};
function imageMarkdown(id: string, alt: string) {
  return `\n\n![${alt.replace(/[\\\[\]\r\n]/g, " ")}](/media/${id})\n\n`;
}
export function ContentEditor({
  initial,
  taxonomies,
  topics,
  siteOrigin,
}: {
  initial: AdminContent;
  taxonomies: Taxonomy[];
  topics: { id: string; title: string }[];
  siteOrigin: string;
}) {
  const [jobs, setJobs] = useState<UploadJob[]>([]),
    [publicationUncertain, setPublicationUncertain] = useState(false);
  const unfinished = jobs.some((job) => !job.done);
  const {
    item,
    draft,
    dirty,
    saving,
    issue,
    conflict,
    update,
    replace,
    flush,
  } = useDraft(initial, unfinished || publicationUncertain);
  const editor = useRef<EditorHandle>(null),
    fileInput = useRef<HTMLInputElement>(null),
    uploadQueue = useRef(Promise.resolve()),
    titleInput = useRef<HTMLTextAreaElement>(null);
  const publicationAttempt = useRef<{
    version: number;
    revisionId: string;
    key: string;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [panel, setPanel] = useState(false),
    [tab, setTab] = useState("split"),
    [picker, setPicker] = useState<"inline" | "cover" | null>(null),
    [pickerAnchor, setPickerAnchor] = useState(""),
    [error, setError] = useState(""),
    [published, setPublished] = useState<string | null>(null),
    [history, setHistory] = useState<z.infer<typeof historySchema> | null>(
      null,
    ),
    [selectedRevision, setSelectedRevision] = useState<string | null>(null),
    [archiveOpen, setArchiveOpen] = useState(false),
    [reloadOpen, setReloadOpen] = useState(false);
  const patchJob = (id: string, patch: Partial<UploadJob>) =>
    setJobs((jobs) =>
      jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    );
  const enqueue = useCallback((job: UploadJob) => {
    uploadQueue.current = uploadQueue.current.then(async () => {
      try {
        const media = await uploadImage(job.file, (progress) =>
          patchJob(job.id, { progress }),
        );
        editor.current?.insert(
          imageMarkdown(media.id, job.file.name.replace(/\.[^.]+$/, "")),
          job.anchor,
        );
        patchJob(job.id, { done: true, progress: 100 });
      } catch (error) {
        patchJob(job.id, { error: errorMessage(error) });
      }
    });
  }, []);
  const onFiles = useCallback(
    (files: File[], anchor: string) => {
      const additions = files.map((file, index) => ({
        id: crypto.randomUUID(),
        file,
        anchor:
          index === 0 ? anchor : (editor.current?.anchor(anchor) ?? anchor),
        progress: 0,
        error: "",
        done: false,
      }));
      setJobs((current) => [...current, ...additions]);
      for (const job of additions) enqueue(job);
    },
    [enqueue],
  );
  const changeContent = useCallback(
    (content: string) => update({ content }),
    [update],
  );
  const locked = busy || publicationUncertain;
  useEffect(() => {
    const resize = () => {
      if (titleInput.current) {
        titleInput.current.style.height = "auto";
        titleInput.current.style.height = `${titleInput.current.scrollHeight}px`;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draft.title]);
  useEffect(() => {
    const small = window.matchMedia("(max-width:600px)");
    const adjust = () => {
      if (small.matches)
        setTab((current) => (current === "split" ? "edit" : current));
    };
    adjust();
    small.addEventListener("change", adjust);
    return () => small.removeEventListener("change", adjust);
  }, []);
  const online = Boolean(item.publishedRevisionId && !item.archived);
  async function publish() {
    if (busy) return;
    setBusy(true);
    setError("");
    setPublished(null);
    try {
      if (unfinished)
        throw new Error("请先完成图片上传，或移除失败的上传任务。");
      if (!publicationAttempt.current) {
        const saved = await flush();
        publicationAttempt.current = {
          version: saved.version,
          revisionId: saved.draftRevisionId,
          key: crypto.randomUUID(),
        };
      }
      const input = publicationAttempt.current;
      let result;
      try {
        result = await api(
          `admin/contents/${item.id}/publish`,
          publicationSchema,
          "POST",
          input,
        );
      } catch (publishError) {
        try {
          result = await api(
            `admin/publication/${input.key}`,
            publicationSchema,
          );
        } catch {
          if (
            publishError instanceof ApiError &&
            publishError.status >= 400 &&
            publishError.status < 500
          ) {
            publicationAttempt.current = null;
            setPublicationUncertain(false);
            throw publishError;
          }
          setPublicationUncertain(true);
          throw new Error(
            "发布结果暂时无法确认，当前草稿已保存。点击“确认发布结果”继续核对。",
          );
        }
      }
      setPublished(`${siteOrigin}/archives/${encodeURIComponent(result.slug)}`);
      try {
        const current = await api(
          `admin/contents/${item.id}`,
          adminContentSchema,
        );
        replace(current);
        publicationAttempt.current = null;
        setPublicationUncertain(false);
      } catch {
        setPublicationUncertain(true);
        setError(
          "文章已发布；暂时无法读取最新草稿。点击“确认发布结果”后继续编辑。",
        );
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function showHistory() {
    setError("");
    try {
      setHistory(await api(`admin/contents/${item.id}/history`, historySchema));
      setSelectedRevision(null);
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  async function clone() {
    setBusy(true);
    setError("");
    try {
      const copy = await api("admin/contents", adminContentSchema, "POST", {
        kind: draft.kind,
      });
      await api(`admin/contents/${copy.id}`, adminContentSchema, "PUT", {
        version: copy.version,
        draft: {
          ...draft,
          title: `${draft.title}（副本）`,
          slug: "",
          publishedAt: null,
        },
      });
      window.open(`/write/${copy.id}`, "_blank", "noopener");
      setError("当前文字已另存为新草稿。可以重新载入本篇的最新版本。");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const historyEntry = history?.find((entry) => entry.id === selectedRevision);
  return (
    <div className={`editor-page ${panel ? "properties-open" : ""}`}>
      <header className="editor-header">
        <Link href="/" className="back-link" aria-label="返回内容列表">
          <ArrowLeft size={19} />
          <span>内容</span>
        </Link>
        <span className="header-divider" />
        <span className="editor-kind">{kindLabels[draft.kind]}</span>
        <span className="save-state" role="status" aria-live="polite">
          {saving ? (
            <>
              <LoaderCircle className="spin" size={15} />
              保存中
            </>
          ) : issue ? (
            <>
              <CloudOff size={15} />
              保存失败
            </>
          ) : dirty ? (
            <>
              <span className="pending-dot" />
              等待保存
            </>
          ) : (
            <>
              <Check size={15} />
              已保存
            </>
          )}
        </span>
        <div className="editor-actions">
          <button
            className="icon-button"
            onClick={showHistory}
            disabled={locked || unfinished}
            title="历史版本"
            aria-label="历史版本"
          >
            <History size={19} />
          </button>
          <button
            className={`icon-button ${panel ? "active" : ""}`}
            onClick={() => setPanel(!panel)}
            aria-label="文章属性"
            title="文章属性"
            aria-expanded={panel}
          >
            <SlidersHorizontal size={19} />
          </button>
          {["article", "tutorial"].includes(draft.kind) && (
            <button
              className="button primary"
              onClick={publish}
              disabled={busy || saving || unfinished || conflict}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Upload size={16} />
              )}{" "}
              {publicationUncertain
                ? "确认发布结果"
                : online
                  ? "发布更新"
                  : "发布文章"}
            </button>
          )}
        </div>
      </header>
      {issue && (
        <div className="notice error" role="alert">
          <span>{issue}</span>
          {conflict ? (
            <>
              <button
                className="text-button"
                onClick={() => setReloadOpen(true)}
              >
                载入最新版本
              </button>
              <button className="text-button" onClick={clone} disabled={locked}>
                将当前文字另存为草稿
              </button>
            </>
          ) : (
            <button
              className="text-button"
              onClick={() => void flush().catch(() => {})}
            >
              重试保存
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button
            className="icon-button"
            onClick={() => setError("")}
            aria-label="关闭提示"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {published && (
        <div className="notice success" role="status">
          <Check size={17} />
          已发布，博客已更新。
          <a href={published} target="_blank" rel="noreferrer">
            查看文章 <ArrowUpRight size={15} />
          </a>
        </div>
      )}
      <div className="editor-title-block">
        <div className="editor-status-line">
          <span
            className={`status-badge ${item.archived ? "archived" : online ? "published" : "draft"}`}
          >
            {item.archived ? "已归档" : online ? "已发布" : "草稿"}
          </span>
          <span>
            {online
              ? "你的修改会先保存为草稿。"
              : draft.kind === "note" || draft.kind === "topic"
                ? "保存在个人后台，暂无公开页面。"
                : "慢慢写，准备好再与读者分享。"}
          </span>
        </div>
        <label className="sr-only" htmlFor="article-title">
          文章标题
        </label>
        <textarea
          id="article-title"
          ref={titleInput}
          className="title-input"
          placeholder="给这篇文字一个标题"
          rows={2}
          maxLength={240}
          value={draft.title}
          disabled={locked}
          onChange={(e) => update({ title: e.target.value })}
          onBlur={() => {
            if (!draft.slug && draft.title)
              update({
                slug: slugify(draft.title).slice(0, 180).replace(/-$/g, ""),
              });
          }}
        />
        <div className="editor-byline">
          <span>{kindLabels[draft.kind]}</span>
          <span>
            {deriveWordCount(draft.content).toLocaleString("zh-CN")} 字
          </span>
          <span>约 {deriveReadingMinutes(draft.content)} 分钟阅读</span>
          {online && (
            <a
              href={`${siteOrigin}/archives/${encodeURIComponent(item.publishedSlug ?? draft.slug)}`}
              target="_blank"
              rel="noreferrer"
            >
              已发布版本 <ArrowUpRight size={13} />
            </a>
          )}
        </div>
      </div>
      <div className="editor-workspace">
        <div className="writing-workspace">
          <div className="writing-toolbar">
            <div className="format-tools" aria-label="Markdown 格式">
              <button
                className="icon-button"
                title="二级标题"
                aria-label="插入二级标题"
                disabled={locked}
                onClick={() => editor.current?.format("\n## ", "")}
              >
                <Heading2 size={18} />
              </button>
              <button
                className="icon-button"
                title="粗体"
                aria-label="粗体"
                disabled={locked}
                onClick={() => editor.current?.format("**")}
              >
                <Bold size={17} />
              </button>
              <button
                className="icon-button"
                title="斜体"
                aria-label="斜体"
                disabled={locked}
                onClick={() => editor.current?.format("*")}
              >
                <Italic size={17} />
              </button>
              <button
                className="icon-button"
                title="列表"
                aria-label="插入列表"
                disabled={locked}
                onClick={() => editor.current?.format("\n- ", "")}
              >
                <List size={18} />
              </button>
              <button
                className="icon-button"
                title="代码块"
                aria-label="插入代码块"
                disabled={locked}
                onClick={() => editor.current?.format("\n```\n", "\n```\n")}
              >
                <Code2 size={18} />
              </button>
              <span className="toolbar-divider" />
              <button
                className="icon-button"
                title="上传图片"
                aria-label="上传图片"
                disabled={locked}
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus size={18} />
              </button>
              <button
                className="icon-button"
                title="从媒体库插图"
                aria-label="从媒体库插图"
                disabled={locked}
                onClick={() => {
                  setPickerAnchor(editor.current?.anchor() ?? "");
                  setPicker("inline");
                }}
              >
                <Images size={18} />
              </button>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                hidden
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length)
                    onFiles(files, editor.current?.anchor() ?? "");
                  e.target.value = "";
                }}
              />
            </div>
            <div className="view-tabs" aria-label="编辑器视图">
              {[
                ["edit", "编辑"],
                ["split", "对照"],
                ["preview", "预览"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={tab === value ? "active" : ""}
                  aria-pressed={tab === value}
                  onClick={() => setTab(value!)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {jobs.length > 0 && (
            <div className="upload-jobs">
              {jobs
                .filter((job) => !job.done)
                .map((job) => (
                  <div
                    key={job.id}
                    className={`upload-job ${job.error ? "error-text" : ""}`}
                    role="status"
                  >
                    <span>{job.file.name}</span>
                    {job.error ? (
                      <>
                        <span>{job.error}</span>
                        <button
                          className="text-button"
                          onClick={() => {
                            patchJob(job.id, { error: "", progress: 0 });
                            enqueue(job);
                          }}
                        >
                          重试
                        </button>
                        <button
                          className="icon-button"
                          onClick={() =>
                            setJobs((jobs) =>
                              jobs.filter((current) => current.id !== job.id),
                            )
                          }
                          aria-label={`移除 ${job.file.name} 的失败上传`}
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <progress max={100} value={job.progress} />
                        <span>{job.progress}%</span>
                      </>
                    )}
                  </div>
                ))}
            </div>
          )}
          <div className={`writing-panes view-${tab}`}>
            <section className="source-pane" aria-label="Markdown 编辑">
              <div className="pane-label">
                MARKDOWN<span>拖入图片或粘贴截图</span>
              </div>
              <MarkdownEditor
                ref={editor}
                value={draft.content}
                onChange={changeContent}
                onFiles={onFiles}
                disabled={locked}
              />
            </section>
            <section className="preview-pane" aria-label="文章预览">
              <div className="pane-label">
                实时预览<span>与博客正文使用相同排版</span>
              </div>
              <div className="preview-content">
                {draft.content ? (
                  <MarkdownContent
                    content={draft.content}
                    mediaBase="/api/admin/media"
                  />
                ) : (
                  <p className="preview-placeholder">
                    你的文字会在这里慢慢成形。
                  </p>
                )}
              </div>
            </section>
          </div>
          <footer className="editor-footnote">
            <span>Markdown · 自动保存草稿</span>
            <button
              className="text-button"
              disabled={!dirty || saving || busy}
              onClick={() => void flush().catch(() => {})}
            >
              立即保存
            </button>
          </footer>
        </div>
        {panel && (
          <aside className="properties-panel">
            <header>
              <h2>文章属性</h2>
              <button
                className="icon-button"
                onClick={() => setPanel(false)}
                aria-label="关闭文章属性"
              >
                <X size={18} />
              </button>
            </header>
            <fieldset disabled={locked}>
              <label>
                固定地址
                <input
                  value={draft.slug}
                  placeholder="article-slug"
                  maxLength={180}
                  onChange={(e) => update({ slug: e.target.value })}
                />
                <span className="field-help">
                  /archives/{draft.slug || "你的文章地址"}
                </span>
              </label>
              <label>
                摘要
                <textarea
                  value={draft.summary}
                  rows={4}
                  maxLength={2000}
                  placeholder="用几句话，介绍这篇文字。留空时自动摘取正文。"
                  onChange={(e) => update({ summary: e.target.value })}
                />
              </label>
              <label>
                分类
                <select
                  value={draft.categoryId ?? ""}
                  onChange={(e) =>
                    update({ categoryId: e.target.value || null })
                  }
                >
                  <option value="">未分类</option>
                  {taxonomies
                    .filter((t) => t.kind === "category")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                系列
                <select
                  value={draft.seriesId ?? ""}
                  onChange={(e) => update({ seriesId: e.target.value || null })}
                >
                  <option value="">不属于系列</option>
                  {taxonomies
                    .filter((t) => t.kind === "series")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </label>
              {draft.seriesId && (
                <label>
                  系列顺序
                  <input
                    type="number"
                    min={0}
                    value={draft.seriesOrder ?? ""}
                    onChange={(e) =>
                      update({
                        seriesOrder:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
              )}
              <div className="field-group">
                <span>标签</span>
                <div className="tag-options">
                  {taxonomies
                    .filter((t) => t.kind === "tag")
                    .map((t) => (
                      <label key={t.id} className="tag-option">
                        <input
                          type="checkbox"
                          checked={draft.tagIds.includes(t.id)}
                          onChange={(e) =>
                            update({
                              tagIds: e.target.checked
                                ? [...draft.tagIds, t.id]
                                : draft.tagIds.filter((id) => id !== t.id),
                            })
                          }
                        />
                        <span>{t.name}</span>
                      </label>
                    ))}
                  {!taxonomies.some((t) => t.kind === "tag") && (
                    <Link href="/organize" className="field-help">
                      先添加一个标签
                    </Link>
                  )}
                </div>
              </div>
              {topics.length > 0 && (
                <div className="field-group">
                  <span>关联专题</span>
                  {topics
                    .filter((topic) => topic.id !== item.id)
                    .map((topic) => (
                      <label key={topic.id} className="check-field">
                        <input
                          type="checkbox"
                          checked={draft.topicIds.includes(topic.id)}
                          onChange={(e) =>
                            update({
                              topicIds: e.target.checked
                                ? [...draft.topicIds, topic.id]
                                : draft.topicIds.filter(
                                    (id) => id !== topic.id,
                                  ),
                            })
                          }
                        />
                        {topic.title || "未命名专题"}
                      </label>
                    ))}
                </div>
              )}
              <div className="field-group">
                <span>封面</span>
                {draft.coverId ? (
                  <div className="cover-selection">
                    <img
                      src={`/api/admin/media/${draft.coverId}`}
                      alt="当前文章封面"
                    />
                    <div>
                      <button
                        className="text-button"
                        onClick={() => setPicker("cover")}
                      >
                        更换封面
                      </button>
                      <button
                        className="text-button"
                        onClick={() => update({ coverId: null })}
                      >
                        移除
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="cover-empty"
                    onClick={() => setPicker("cover")}
                  >
                    <ImagePlus size={23} strokeWidth={1.4} />
                    选择一张封面
                  </button>
                )}
              </div>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={(e) => update({ featured: e.target.checked })}
                />
                在首页精选中展示
              </label>
              <label>
                发布时间
                <input
                  type="datetime-local"
                  value={
                    draft.publishedAt
                      ? new Date(
                          new Date(draft.publishedAt).getTime() -
                            new Date(draft.publishedAt).getTimezoneOffset() *
                              60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) =>
                    update({
                      publishedAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
                <span className="field-help">留空时使用首次发布的时间。</span>
              </label>
            </fieldset>
            <button
              className="button danger"
              disabled={locked || unfinished || item.archived}
              onClick={() => setArchiveOpen(true)}
            >
              <Archive size={16} />
              归档这篇内容
            </button>
          </aside>
        )}
      </div>
      {picker && (
        <MediaPicker
          onClose={() => setPicker(null)}
          onSelect={(media: Media, alt) => {
            if (picker === "cover") update({ coverId: media.id });
            else
              editor.current?.insert(
                imageMarkdown(media.id, alt),
                pickerAnchor,
              );
            setPicker(null);
          }}
        />
      )}
      {history && (
        <Dialog title="历史版本" onClose={() => setHistory(null)} wide>
          <p className="muted">恢复后先成为草稿，发布前不会改变博客。</p>
          <div className="history-layout">
            <div className="history-list">
              {history.map((entry) => (
                <button
                  className={selectedRevision === entry.id ? "active" : ""}
                  key={entry.id}
                  onClick={() => setSelectedRevision(entry.id)}
                >
                  <strong>{entry.data.title || "未命名草稿"}</strong>
                  <span>
                    {dateLabel(entry.createdAt)}{" "}
                    {new Date(entry.createdAt).toLocaleTimeString("zh-CN")} ·{" "}
                    {entry.source === "restore"
                      ? "恢复"
                      : entry.source === "publish"
                        ? "发布"
                        : "保存"}
                    {entry.id === item.publishedRevisionId ? " · 线上版本" : ""}
                  </span>
                </button>
              ))}
            </div>
            <div className="history-preview">
              {historyEntry ? (
                <>
                  <h3>{historyEntry.data.title}</h3>
                  <MarkdownContent
                    content={historyEntry.data.content}
                    mediaBase="/api/admin/media"
                  />
                  <button
                    className="button primary"
                    disabled={locked || unfinished}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const current = await flush();
                        const restored = await api(
                          `admin/contents/${item.id}/restore`,
                          adminContentSchema,
                          "POST",
                          {
                            version: current.version,
                            revisionId: historyEntry.id,
                          },
                        );
                        replace(restored);
                        setHistory(null);
                      } catch (error) {
                        setError(errorMessage(error));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    恢复为草稿
                  </button>
                </>
              ) : (
                <p className="muted">选择一个版本查看正文。</p>
              )}
            </div>
          </div>
        </Dialog>
      )}
      {archiveOpen && (
        <Dialog title="归档这篇内容？" onClose={() => setArchiveOpen(false)}>
          <p>
            归档后，读者将无法访问这篇文章。正文和历史仍会保留，之后可以重新发布。
          </p>
          <div className="dialog-actions">
            <button className="button" onClick={() => setArchiveOpen(false)}>
              继续编辑
            </button>
            <button
              className="button danger"
              disabled={locked}
              onClick={async () => {
                setBusy(true);
                try {
                  const current = await flush();
                  replace(
                    await api(
                      `admin/contents/${item.id}/archive`,
                      adminContentSchema,
                      "POST",
                      { version: current.version },
                    ),
                  );
                  setArchiveOpen(false);
                } catch (error) {
                  setError(errorMessage(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              确认归档
            </button>
          </div>
        </Dialog>
      )}
      {reloadOpen && (
        <Dialog title="载入最新版本？" onClose={() => setReloadOpen(false)}>
          <p>
            这会替换当前页面尚未保存的文字。你也可以先关闭此提示，将当前文字另存为新草稿。
          </p>
          <button
            className="button primary"
            onClick={async () => {
              try {
                replace(
                  await api(`admin/contents/${item.id}`, adminContentSchema),
                );
                setReloadOpen(false);
              } catch (error) {
                setError(errorMessage(error));
              }
            }}
          >
            载入最新版本
          </button>
        </Dialog>
      )}
    </div>
  );
}
