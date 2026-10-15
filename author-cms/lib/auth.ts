import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getStore } from "./store";
import { readEnvironment } from "./env";
import { CmsError } from "./errors";
function scrypt(
  password: string,
  salt: string,
  length: number,
  options: typeof COST,
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCallback(password, salt, length, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
const COST = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 256)
    throw new CmsError(422, "密码长度需为 12—256 个字符");
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, COST);
  return `scrypt$32768$8$1$${salt}$${Buffer.from(key).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const match = encoded.match(
    /^scrypt\$32768\$8\$1\$([a-f\d]{32})\$([a-f\d]{128})$/,
  );
  if (!match?.[1] || !match[2] || password.length > 256) return false;
  const key = Buffer.from(await scrypt(password, match[1], 64, COST));
  return timingSafeEqual(key, Buffer.from(match[2], "hex"));
}
export async function resetOwner(password: string) {
  const hash = await hashPassword(password);
  await getStore().db.transaction(async (tx) => {
    await tx.execute(
      sql`INSERT INTO author_cms.owner(id,password_hash) VALUES(1,${hash}) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash`,
    );
    await tx.execute(sql`DELETE FROM author_cms.sessions`);
  });
}
export function cookieName() {
  return readEnvironment().secure ? "__Host-blog_owner" : "blog_owner_dev";
}
export function sessionCookie(token: string, expired = false) {
  return `${cookieName()}=${expired ? "" : token}; Path=/; HttpOnly; SameSite=Strict; ${readEnvironment().secure ? "Secure; " : ""}Max-Age=${expired ? 0 : 7 * 24 * 60 * 60}`;
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== readEnvironment().origin)
    throw new CmsError(403, "请求来源无效，请从后台页面重试。");
}
export function requireReader(request: Request) {
  const incoming =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (
    !timingSafeEqual(
      Buffer.from(digest(incoming)),
      Buffer.from(digest(readEnvironment().readToken)),
    )
  )
    throw new CmsError(401, "需要发布读取凭据");
}
function requestToken(request: Request) {
  const name = `${cookieName()}=`;
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(name))
      ?.slice(name.length) ?? ""
  );
}
export async function requireOwner(request: Request) {
  const token = requestToken(request);
  if (!/^[a-f\d]{64}$/.test(token)) throw new CmsError(401, "请先登录后台");
  const result = await getStore().db.execute(
    sql`UPDATE author_cms.sessions SET last_seen=now() WHERE token_hash=${digest(token)} AND expires_at>now() AND last_seen>now()-interval '24 hours' RETURNING token_hash`,
  );
  if (!result.rows.length) throw new CmsError(401, "登录已过期，请重新登录");
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method))
    checkOrigin(request);
}
let activeLogin = false;
export async function login(request: Request, password: string) {
  checkOrigin(request);
  if (activeLogin) throw new CmsError(429, "正在验证登录，请稍后重试。");
  activeLogin = true;
  try {
    const key = digest(
      readEnvironment().trustProxy
        ? (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "owner")
        : "owner",
    );
    const result = await getStore().db.execute(
      sql`INSERT INTO author_cms.login_limits(key,attempts,blocked_until) VALUES(${key},1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN author_cms.login_limits.blocked_until<now() THEN 1 ELSE author_cms.login_limits.attempts+1 END,blocked_until=CASE WHEN author_cms.login_limits.blocked_until<now() THEN now()+interval '15 minutes' ELSE author_cms.login_limits.blocked_until END,updated_at=now() RETURNING attempts`,
    );
    if (z.object({ attempts: z.number() }).parse(result.rows[0]).attempts > 5)
      throw new CmsError(429, "尝试次数过多，请 15 分钟后重试。");
    const row = (
      await getStore().db.execute(
        sql`SELECT password_hash FROM author_cms.owner WHERE id=1`,
      )
    ).rows[0];
    if (!row)
      throw new CmsError(503, "后台尚未初始化，请先在服务器设置所有者密码。");
    if (
      !(await verifyPassword(
        password,
        z.object({ password_hash: z.string() }).parse(row).password_hash,
      ))
    )
      throw new CmsError(401, "密码不正确，请重试。");
    const token = randomBytes(32).toString("hex");
    await getStore().db.transaction(async (tx) => {
      await tx.execute(
        sql`DELETE FROM author_cms.login_limits WHERE key=${key}`,
      );
      await tx.execute(
        sql`DELETE FROM author_cms.sessions WHERE expires_at<now()`,
      );
      await tx.execute(
        sql`INSERT INTO author_cms.sessions(token_hash,expires_at) VALUES(${digest(token)},now()+interval '7 days')`,
      );
    });
    return token;
  } finally {
    activeLogin = false;
  }
}
export async function logout(request: Request) {
  await getStore().db.execute(
    sql`DELETE FROM author_cms.sessions WHERE token_hash=${digest(requestToken(request))}`,
  );
}
