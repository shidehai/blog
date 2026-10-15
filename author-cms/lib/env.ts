import { z } from "zod";
const httpUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    ["http:", "https:"].includes(url.protocol) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    (url.pathname === "/" || url.pathname === "")
  );
});
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  CMS_ORIGIN: httpUrl,
  CMS_SITE_ORIGIN: httpUrl.default("http://localhost:4321"),
  CMS_READ_TOKEN: z.string().min(32),
  CMS_MEDIA_ROOT: z.string().min(1),
  CMS_TRUST_PROXY: z.enum(["true", "false"]).default("false"),
});
export function readEnvironment(input = process.env) {
  const result = envSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      `CMS 配置无效：${[...new Set(result.error.issues.map((issue) => issue.path[0]))].join(", ")}`,
    );
  let url: URL;
  try {
    url = new URL(result.data.DATABASE_URL);
  } catch {
    throw new Error("CMS 配置无效：DATABASE_URL");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("CMS 配置无效：DATABASE_URL");
  return {
    databaseUrl: result.data.DATABASE_URL,
    origin: new URL(result.data.CMS_ORIGIN).origin,
    siteOrigin: new URL(result.data.CMS_SITE_ORIGIN).origin,
    readToken: result.data.CMS_READ_TOKEN,
    mediaRoot: result.data.CMS_MEDIA_ROOT,
    trustProxy: result.data.CMS_TRUST_PROXY === "true",
    secure: result.data.CMS_ORIGIN.startsWith("https:"),
  };
}
