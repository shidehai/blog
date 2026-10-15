"use client";
import { useState } from "react";
import { z } from "zod";
import { Check, Download, ImagePlus } from "lucide-react";
import { siteProfileSchema, type SiteProfile } from "@blog/content-contracts";
import { api, errorMessage } from "../lib/client";
import { MediaPicker } from "./MediaLibrary";
export function Settings({
  initial,
}: {
  initial: { profile: SiteProfile; version: number };
}) {
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [picker, setPicker] = useState(false);
  const change = (patch: Partial<SiteProfile>) => {
    setData({ ...data, profile: { ...data.profile, ...patch } });
    setMessage("");
  };
  const fields = [
    { key: "name", label: "名称", limit: 120 },
    { key: "handle", label: "用户名", limit: 120 },
    { key: "title", label: "站点标题", limit: 240 },
    { key: "location", label: "所在地", limit: 120 },
    { key: "hitokoto", label: "一句话", limit: 500 },
  ] as const;
  return (
    <div className="content-page narrow-page">
      <header className="page-heading">
        <div>
          <h1>站点资料</h1>
          <p>在博客上，留下属于你的介绍。</p>
        </div>
      </header>
      <form
        className="settings-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const saved = await api(
              "admin/profile",
              z.object({ profile: siteProfileSchema, version: z.number() }),
              "PUT",
              data,
            );
            setData(saved);
            setMessage("资料已保存，博客已更新。");
          } catch (error) {
            setError(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <div className="avatar-setting">
            {data.profile.avatar ? (
              <img
                src={data.profile.avatar.replace(
                  /^\/media\//,
                  "/api/admin/media/",
                )}
                alt="站点头像"
              />
            ) : (
              <div className="avatar-placeholder">青</div>
            )}
            <div>
              <button
                className="button"
                type="button"
                onClick={() => setPicker(true)}
              >
                <ImagePlus size={16} />
                选择头像
              </button>
              <p className="field-help">保存资料后，头像将公开展示。</p>
            </div>
          </div>
          <div className="settings-grid">
            {fields.map((field) => (
              <label key={field.key}>
                {field.label}
                <input
                  value={data.profile[field.key]}
                  maxLength={field.limit}
                  required={field.key === "name"}
                  onChange={(e) => change({ [field.key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <label>
            个人介绍
            <textarea
              rows={4}
              maxLength={4000}
              value={data.profile.bio}
              onChange={(e) => change({ bio: e.target.value })}
            />
          </label>
          <h2>社交链接</h2>
          <div className="settings-grid">
            {(["github", "about", "email"] as const).map((key) => (
              <label key={key}>
                {key === "github"
                  ? "GitHub"
                  : key === "about"
                    ? "关于页面"
                    : "邮箱链接"}
                <input
                  value={data.profile.socials[key]}
                  placeholder={
                    key === "email"
                      ? "mailto:you@example.com"
                      : key === "about"
                        ? "/about"
                        : "https://github.com/…"
                  }
                  maxLength={2000}
                  onChange={(e) =>
                    change({
                      socials: {
                        ...data.profile.socials,
                        [key]: e.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice success" role="status">
            <Check size={16} />
            {message}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          <Check size={16} />
          {busy ? "正在保存…" : "保存并更新博客"}
        </button>
      </form>
      <section className="export-section">
        <div>
          <h2>内容属于你</h2>
          <p>
            导出正文、属性、关系和历史清单。图片原文件通过备份工具一并保存。
          </p>
        </div>
        <a className="button" href="/api/admin/export" download>
          <Download size={16} />
          导出内容
        </a>
      </section>
      {picker && (
        <MediaPicker
          onClose={() => setPicker(false)}
          onSelect={(media) => {
            change({ avatar: `/media/${media.id}` });
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}
