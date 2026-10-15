"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Images,
  Upload,
  Search,
  LoaderCircle,
  Check,
  Shield,
  ArrowUpRight,
} from "lucide-react";
import { z } from "zod";
import { mediaSchema, type Media } from "@blog/content-contracts";
import { cmsPath } from "@blog/content-contracts/paths";
import { api, errorMessage, uploadImage } from "../lib/client";
import { Dialog } from "./Dialog";
export function MediaLibrary({
  initial,
  onSelect,
  onUploadingChange,
}: {
  initial: Media[];
  onSelect?: (media: Media, alt: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [items, setItems] = useState(initial),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Media | null>(null),
    [alt, setAlt] = useState(""),
    [error, setError] = useState(""),
    [progress, setProgress] = useState<number | null>(null),
    [failed, setFailed] = useState<File | null>(null),
    [references, setReferences] = useState<
      | {
          id: string;
          title: string;
          draft: boolean;
          published: boolean;
          history: number;
        }[]
      | null
    >(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (progress === null) return;
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [progress]);
  const filtered = items.filter((item) =>
    item.filename.toLowerCase().includes(query.toLowerCase()),
  );
  async function upload(file: File) {
    setError("");
    setFailed(null);
    setProgress(0);
    onUploadingChange?.(true);
    try {
      const media = await uploadImage(file, setProgress);
      setItems((current) => [media, ...current]);
      setSelected(media);
      setAlt(file.name.replace(/\.[^.]+$/, ""));
    } catch (error) {
      setError(errorMessage(error));
      setFailed(file);
    } finally {
      setProgress(null);
      onUploadingChange?.(false);
    }
  }
  async function inspect(media: Media) {
    setSelected(media);
    setAlt(media.filename.replace(/\.[^.]+$/, ""));
    if (!onSelect) {
      try {
        setReferences(
          await api(
            `admin/media/${media.id}/references`,
            z.array(
              z.object({
                id: z.uuid(),
                title: z.string(),
                draft: z.boolean(),
                published: z.boolean(),
                history: z.number().int(),
              }),
            ),
          ),
        );
      } catch (error) {
        setError(errorMessage(error));
      }
    }
  }
  return (
    <div className="media-library">
      <div className="media-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            type="search"
            aria-label="搜索图片"
            placeholder="搜索图片名称"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
        <button
          className="button"
          disabled={progress !== null}
          onClick={() => input.current?.click()}
        >
          <Upload size={16} />
          {progress === null ? "上传图片" : `上传中 ${progress}%`}
        </button>
      </div>
      {progress !== null && (
        <div className="upload-progress" role="status">
          <LoaderCircle size={16} className="spin" />
          正在上传并校验图片… {progress}%<progress value={progress} max={100} />
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
          {failed && (
            <button className="text-button" onClick={() => void upload(failed)}>
              重试上传
            </button>
          )}
        </div>
      )}
      <div className="media-grid">
        {filtered.map((media) => (
          <button
            key={media.id}
            className={`media-tile ${selected?.id === media.id ? "selected" : ""}`}
            onClick={() => void inspect(media)}
            aria-pressed={selected?.id === media.id}
          >
            <div className="media-image">
              <img
                src={cmsPath(`/api/admin/media/${media.id}`)}
                alt={media.filename}
                loading="lazy"
                width={media.width}
                height={media.height}
              />
              {selected?.id === media.id && (
                <span className="media-check">
                  <Check size={16} />
                </span>
              )}
              {!media.publishable && (
                <span className="media-shield">
                  <Shield size={16} />
                </span>
              )}
            </div>
            <span className="media-name">{media.filename}</span>
            <span className="media-meta">
              {media.width} × {media.height} ·{" "}
              {(media.bytes / 1024 / 1024).toFixed(1)} MB
            </span>
          </button>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="empty-state">
          <Images size={38} strokeWidth={1.2} />
          <h2>{query ? "没有找到图片" : "文字之外，也留下画面"}</h2>
          <p>
            {query
              ? "试试其他图片名称。"
              : "上传一张图片，写作时就能随时选用。"}
          </p>
          <span className="muted">PNG、JPEG、WebP、GIF、AVIF · 最大 20 MB</span>
        </div>
      )}
      {onSelect && selected && (
        <div className="media-selection">
          <label>
            图片替代文本
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              maxLength={500}
              placeholder="描述图片，帮助读者理解画面"
            />
          </label>
          <button
            className="button primary"
            disabled={progress !== null}
            onClick={() => onSelect(selected, alt)}
          >
            <Check size={16} />
            使用这张图片
          </button>
        </div>
      )}
      {!onSelect && selected && (
        <Dialog
          title={selected.filename}
          onClose={() => {
            setSelected(null);
            setReferences(null);
          }}
        >
          <img
            className="media-detail-image"
            src={cmsPath(`/api/admin/media/${selected.id}`)}
            alt={selected.filename}
          />
          <p className="muted">
            {selected.width} × {selected.height} · {selected.mime}
          </p>
          <label className="check-field">
            <input
              type="checkbox"
              checked={selected.publishable}
              onChange={async (e) => {
                const allowed = e.target.checked;
                try {
                  const result = await api(
                    `admin/media/${selected.id}`,
                    mediaSchema,
                    "PATCH",
                    { publishable: allowed },
                  );
                  setSelected(result);
                  setItems((items) =>
                    items.map((item) =>
                      item.id === result.id ? result : item,
                    ),
                  );
                } catch (error) {
                  setError(errorMessage(error));
                }
              }}
            />
            允许文章发布时公开此图片
          </label>
          <p className="field-help">
            关闭后，即使文章引用此图片，读者也无法访问。
          </p>
          <h3>使用位置</h3>
          {references === null ? (
            <p>正在读取引用…</p>
          ) : references.length ? (
            references.map((reference) => (
              <Link
                className="media-reference"
                href={`/write/${reference.id}`}
                key={reference.id}
              >
                {reference.title || "未命名草稿"}
                <small>
                  {reference.published ? "已发布 · " : ""}
                  {reference.draft ? "当前草稿 · " : ""}
                  {reference.history} 个历史版本
                </small>
                <ArrowUpRight size={16} />
              </Link>
            ))
          ) : (
            <p className="muted">尚未被内容引用。原文件会保留在媒体库。</p>
          )}
        </Dialog>
      )}
    </div>
  );
}
export function MediaPicker({
  onSelect,
  onClose,
}: {
  onSelect: (media: Media, alt: string) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<Media[] | null>(null),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api("admin/media", z.array(mediaSchema))
      .then((data) => {
        if (active) setData(data);
      })
      .catch((error) => {
        if (active) setError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <Dialog
      title="从媒体库选择"
      onClose={onClose}
      closeDisabled={uploading}
      wide
    >
      {error ? (
        <p role="alert">{error}</p>
      ) : data ? (
        <MediaLibrary
          initial={data}
          onSelect={onSelect}
          onUploadingChange={setUploading}
        />
      ) : (
        <p role="status">正在打开媒体库…</p>
      )}
    </Dialog>
  );
}
