import { getPool, closePool } from "../lib/db";
import { migrate } from "../lib/migrate";
import { resetOwner } from "../lib/auth";
try {
  const command = process.argv[2];
  if (command === "migrate") {
    await migrate(getPool());
    console.log("CMS 数据库迁移完成。");
  } else if (command === "owner") {
    let password = process.env.CMS_OWNER_PASSWORD;
    if (process.argv.includes("--password-stdin")) {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
      password = Buffer.concat(chunks)
        .toString("utf8")
        .replace(/\r?\n$/, "");
    }
    if (!password)
      throw new Error(
        "通过 --password-stdin 或 CMS_OWNER_PASSWORD 提供所有者密码。",
      );
    await resetOwner(password);
    console.log("唯一所有者密码已设置，旧会话已撤销。");
  } else throw new Error("用法：manage.mts migrate | owner --password-stdin");
} catch (error) {
  console.error(error instanceof Error ? error.message : "管理操作失败");
  process.exitCode = 1;
} finally {
  await closePool();
}
