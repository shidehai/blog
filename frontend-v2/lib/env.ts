/**
 * V2 环境变量边界：全站只在这里解析 process.env。
 *
 * 与 V1 的 scripts/env.mjs 共用同一套规则（token 至少 24 位、URL 需可解析），
 * 但不跨包 import：那需要给 webpack 额外配 alias 才能在运行时解析，
 * 会把 V1 的构建脚本拉进 V2 的打包图。为两个变量付这个代价不值得。
 *
 * 校验失败按“缺凭据”处理，由 loadFromDirectus 降级到夹具（PRD 2.4）。
 */
import { z } from "zod";

const schema = z.object({
  DIRECTUS_URL: z.string().url().optional(),
  DIRECTUS_BUILD_TOKEN: z.string().min(24).optional(),
});

export interface DirectusCredentials {
  url: string;
  token: string;
}

/**
 * 读取 Directus 凭据。未配置或格式非法时返回 null，调用方据此降级。
 *
 * 格式非法会打一条 warn：静默降级会让配错的 token 看起来像“没配”，
 * 排查时无从下手。
 */
export function readDirectusCredentials(
  input: NodeJS.ProcessEnv = process.env,
): DirectusCredentials | null {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    console.warn(`[env] Directus 凭据格式非法（${fields}），降级到夹具`);
    return null;
  }

  const { DIRECTUS_URL: url, DIRECTUS_BUILD_TOKEN: token } = parsed.data;
  if (!url || !token) return null;

  return { url: url.replace(/\/$/, ""), token };
}
