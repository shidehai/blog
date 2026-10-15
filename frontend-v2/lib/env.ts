/**
 * V2 环境变量边界：全站只在这里解析 process.env。
 *
 * 正常生产请求默认使用 cms；本地 fixture 只在明确选择或开发默认下使用。
 */
import { z } from "zod";

const httpOriginSchema = z.url().refine((value) => {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/"
    );
  } catch {
    return false;
  }
});

const runtimeConfigSchema = z.object({
  CMS_INTERNAL_URL: httpOriginSchema,
  CMS_READ_TOKEN: z.string().min(32),
  SITE_URL: httpOriginSchema,
});

export function readRuntimeEnvironment(
  input: NodeJS.ProcessEnv = process.env,
):
  | { source: "fixture"; siteUrl: string }
  | { source: "cms"; url: string; token: string; siteUrl: string } {
  const source =
    input.CONTENT_SOURCE ||
    (input.NODE_ENV === "production" ? "cms" : "fixture");
  if (source !== "cms" && source !== "fixture") {
    throw new Error("[env] CONTENT_SOURCE must be cms or fixture");
  }
  const siteUrl =
    input.SITE_URL ||
    (source === "fixture" || input.NODE_ENV !== "production"
      ? "http://localhost:4321"
      : undefined);
  if (source === "fixture") {
    const parsed = httpOriginSchema.safeParse(siteUrl);
    if (!parsed.success)
      throw new Error("[env] Invalid runtime configuration: SITE_URL");
    return { source, siteUrl: new URL(parsed.data).origin };
  }
  const parsed = runtimeConfigSchema.safeParse({ ...input, SITE_URL: siteUrl });
  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path[0])),
    ].join(", ");
    throw new Error(`[env] Invalid CMS runtime configuration: ${fields}`);
  }
  return {
    source,
    url: parsed.data.CMS_INTERNAL_URL.replace(/\/$/, ""),
    token: parsed.data.CMS_READ_TOKEN,
    siteUrl: new URL(parsed.data.SITE_URL).origin,
  };
}
