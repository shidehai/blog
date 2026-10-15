import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  draftSchema,
  contentKindSchema,
  publishSchema,
  saveSchema,
  siteProfileSchema,
  taxonomySchema,
} from "@blog/content-contracts";
import {
  checkOrigin,
  login,
  logout,
  requireOwner,
  requireReader,
  sessionCookie,
} from "./auth";
import { CmsError } from "./errors";
import { getStore } from "./store";
import {
  MAX_IMAGE_BYTES,
  persistImage,
  readVerifiedMedia,
} from "./media-files";
import { readEnvironment } from "./env";
const noStore = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, { status, headers: { ...noStore, ...headers } });
}
async function limitedBody(request: Request, maximum: number) {
  if (Number(request.headers.get("content-length")) > maximum)
    throw new CmsError(413, "请求内容过大");
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new CmsError(413, "请求内容过大");
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(parts);
}
async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const bytes = await limitedBody(request, 2_100_000);
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new CmsError(422, "请求格式无效");
  }
  return schema.parse(value);
}
export async function mediaResponse(id: string, publicOnly: boolean) {
  const file = await getStore().mediaFile(z.uuid().parse(id), publicOnly);
  if (!file) throw new CmsError(404, "图片不存在");
  const bytes = await readVerifiedMedia(readEnvironment().mediaRoot, file);
  return new Response(new Uint8Array(bytes), {
    headers: {
      ...noStore,
      "Content-Type": file.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${file.storage_key}"`,
    },
  });
}
export async function handleApi(
  request: Request,
  path: string[],
): Promise<Response> {
  try {
    const [area, resource, rawId, action] = path;
    if (area === "auth" && resource === "login" && request.method === "POST") {
      const { password } = await body(
        request,
        z.object({ password: z.string().min(1).max(256) }),
      );
      const token = await login(request, password);
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(token) });
    }
    if (area === "public") {
      requireReader(request);
      if (request.method !== "GET") throw new CmsError(405, "此接口只允许读取");
      if (resource === "catalog" && path.length === 2)
        return json(await getStore().catalog());
      if (resource === "generation" && path.length === 2)
        return json({ generation: await getStore().generation() });
      if (resource === "posts" && rawId && path.length === 3) {
        const result = await getStore().detail(rawId);
        if (!result) throw new CmsError(404, "文章不存在");
        return json(result);
      }
      throw new CmsError(404, "接口不存在");
    }
    await requireOwner(request);
    if (area === "auth" && resource === "session" && request.method === "GET")
      return json({ owner: true });
    if (area === "auth" && resource === "logout" && request.method === "POST") {
      await logout(request);
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", true) });
    }
    if (area !== "admin") throw new CmsError(404, "接口不存在");
    if (resource === "contents") {
      if (!rawId) {
        if (request.method === "GET") return json(await getStore().list());
        if (request.method === "POST") {
          const { kind } = await body(
            request,
            z.object({ kind: contentKindSchema }),
          );
          return json(await getStore().create(kind), 201);
        }
      } else {
        const id = z.uuid().parse(rawId);
        if (!action && request.method === "GET")
          return json(await getStore().get(id));
        if (!action && request.method === "PUT") {
          const data = await body(request, saveSchema);
          return json(await getStore().save(id, data.version, data.draft));
        }
        if (action === "publish" && request.method === "POST")
          return json(
            await getStore().publish(id, await body(request, publishSchema)),
          );
        if (action === "archive" && request.method === "POST") {
          const { version } = await body(
            request,
            z.object({ version: z.number().int().positive() }),
          );
          return json(await getStore().archive(id, version));
        }
        if (action === "history" && request.method === "GET")
          return json(await getStore().history(id));
        if (action === "restore" && request.method === "POST") {
          const data = await body(
            request,
            z.object({
              version: z.number().int().positive(),
              revisionId: z.uuid(),
            }),
          );
          return json(
            await getStore().restore(id, data.version, data.revisionId),
          );
        }
      }
    }
    if (resource === "publication" && rawId && request.method === "GET") {
      const result = await getStore().publication(z.uuid().parse(rawId));
      if (!result)
        throw new CmsError(404, "尚未查到该发布结果，可以安全重试。");
      return json(result);
    }
    if (resource === "taxonomies") {
      if (request.method === "GET") return json(await getStore().taxonomies());
      if (request.method === "PUT")
        return json(
          await getStore().saveTaxonomy(await body(request, taxonomySchema)),
        );
    }
    if (resource === "profile") {
      if (request.method === "GET") return json(await getStore().profile());
      if (request.method === "PUT")
        return json(
          await getStore().saveProfile(
            await body(
              request,
              z.object({
                profile: siteProfileSchema,
                version: z.number().int().nonnegative(),
              }),
            ),
          ),
        );
    }
    if (resource === "media") {
      if (rawId && action === "references" && request.method === "GET")
        return json(await getStore().mediaReferences(z.uuid().parse(rawId)));
      if (rawId && request.method === "GET") return mediaResponse(rawId, false);
      if (rawId && request.method === "PATCH") {
        const { publishable } = await body(
          request,
          z.object({ publishable: z.boolean() }),
        );
        return json(
          await getStore().allowMedia(z.uuid().parse(rawId), publishable),
        );
      }
      if (!rawId && request.method === "GET")
        return json(await getStore().media());
      if (!rawId && request.method === "POST") {
        checkOrigin(request);
        const bytes = await limitedBody(request, MAX_IMAGE_BYTES + 64 * 1024);
        const form = await new Response(new Uint8Array(bytes), {
          headers: {
            "Content-Type": request.headers.get("content-type") ?? "",
          },
        }).formData();
        const file = form.get("file");
        if (!(file instanceof File)) throw new CmsError(422, "请选择图片");
        const image = await persistImage(
          readEnvironment().mediaRoot,
          Buffer.from(await file.arrayBuffer()),
          file.name,
          randomUUID(),
        );
        return json(await getStore().addMedia(image), 201);
      }
    }
    if (resource === "export" && request.method === "GET")
      return json(await getStore().exportContent(), 200, {
        "Content-Disposition": "attachment; filename=blog-content.json",
      });
    throw new CmsError(404, "接口不存在");
  } catch (error) {
    return errorResponse(error);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof CmsError)
    return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return json(
      { error: "输入内容不符合要求，请检查必填项、地址和字段长度。" },
      422,
    );
  const cause =
    error instanceof Error && "cause" in error ? error.cause : error;
  if (
    cause &&
    typeof cause === "object" &&
    "code" in cause &&
    cause.code === "23505"
  )
    return json({ error: "地址或名称已存在，请换一个后重试。" }, 409);
  console.error("[author-cms] request failed");
  return json({ error: "内容服务暂时不可用，请稍后重试。" }, 503);
}
export const requestSchemas = { draft: draftSchema };
