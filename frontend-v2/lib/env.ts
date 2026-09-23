/**
 * V2 环境变量边界：全站只在这里解析 process.env。
 *
 * `CONTENT_SOURCE` 只影响构建期快照：fixture 是可离线复现的默认值；
 * directus 则必须带完整凭据，不能静默把生产构建降级成夹具。
 */
import { z } from "zod";

const directusCredentialsSchema = z.object({
  DIRECTUS_URL: z.string().url(),
  DIRECTUS_BUILD_TOKEN: z.string().min(24),
});

export interface DirectusCredentials {
  url: string;
  token: string;
}

export type BuildEnvironment =
  { source: "fixture" } | { source: "directus"; directus: DirectusCredentials };

/**
 * 读取构建时内容源。生产 Directus 构建不能因少一个变量或一次请求失败
 * 而悄悄产出 fixture；错误只报告字段名，绝不回显密钥。
 */
export function readBuildEnvironment(
  input: NodeJS.ProcessEnv = process.env,
): BuildEnvironment {
  const rawSource = input.CONTENT_SOURCE;
  const source =
    rawSource === undefined || rawSource === "" ? "fixture" : rawSource;

  if (source === "fixture") return { source };
  if (source !== "directus") {
    throw new Error(
      "[env] CONTENT_SOURCE must be either fixture or directus for a build",
    );
  }

  const parsed = directusCredentialsSchema.safeParse(input);

  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join("."))),
    ].join(", ");
    throw new Error(`[env] Invalid Directus build configuration: ${fields}`);
  }

  const { DIRECTUS_URL: url, DIRECTUS_BUILD_TOKEN: token } = parsed.data;
  return {
    source,
    directus: { url: url.replace(/\/$/, ""), token },
  };
}
