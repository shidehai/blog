"use client";
import { z } from "zod";
import { mediaSchema } from "@blog/content-contracts";
import { cmsPath } from "@blog/content-contracts/paths";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  schema: z.ZodType<T>,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(cmsPath(`/api/${path}`), {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    signal: AbortSignal.timeout(30000),
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== "auth/login")
      window.dispatchEvent(new Event("cms-session-expired"));
    const error = z.object({ error: z.string() }).safeParse(json);
    throw new ApiError(
      error.success ? error.data.error : "请求失败，请稍后重试。",
      response.status,
    );
  }
  return schema.parse(json);
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请重试。";
}
export function uploadImage(
  file: File,
  onProgress: (progress: number) => void,
) {
  return new Promise<z.infer<typeof mediaSchema>>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", cmsPath("/api/admin/media"));
    request.timeout = 120000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("上传中断，请检查网络后重试。"));
    request.ontimeout = () => reject(new Error("上传超时，可以重试。"));
    request.onload = () => {
      try {
        const result: unknown = JSON.parse(request.responseText);
        if (request.status < 200 || request.status >= 300)
          throw new Error(
            z.object({ error: z.string() }).safeParse(result).data?.error ??
              "上传失败，请重试。",
          );
        resolve(mediaSchema.parse(result));
      } catch (error) {
        reject(error);
      }
    };
    const form = new FormData();
    form.append("file", file);
    request.send(form);
  });
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
export const kindLabels = {
  article: "文章",
  tutorial: "教程",
  note: "随记",
  topic: "专题",
};
