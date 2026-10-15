import { readFile, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { getPool, closePool } from "../lib/db";
import { readEnvironment } from "../lib/env";
import { exportBundle, restoreBundle, readBundle } from "../lib/transfer";
import { exportSource, importSource } from "../lib/source-transfer";
try {
  const [command, folder] = process.argv.slice(2);
  if (!folder)
    throw new Error(
      "用法：transfer.mts export|verify|restore|source-export|source-import PATH",
    );
  if (command === "export") {
    const bundle = await exportBundle(
      getPool(),
      readEnvironment().mediaRoot,
      folder,
    );
    console.log(`已导出内容和 ${bundle.files.length} 个媒体文件。`);
  } else if (command === "verify") {
    const bundle = await readBundle(folder);
    console.log(`清单及 ${bundle.files.length} 个媒体文件校验通过。`);
  } else if (command === "restore") {
    await restoreBundle(getPool(), readEnvironment().mediaRoot, folder);
    console.log("内容及媒体已恢复；所有者密码保留目标配置，未导入会话。");
  } else if (command === "source-export") {
    if (!process.env.SOURCE_DATABASE_URL)
      throw new Error("缺少只读 SOURCE_DATABASE_URL");
    const sourcePool = new Pool({
      connectionString: process.env.SOURCE_DATABASE_URL,
    });
    try {
      const source = await exportSource(sourcePool);
      await writeFile(folder, JSON.stringify(source, null, 2) + "\n", {
        flag: "wx",
        mode: 0o600,
      });
      console.log("源快照已导出；未修改源数据库。");
    } finally {
      await sourcePool.end();
    }
  } else if (command === "source-import") {
    if (!process.env.SOURCE_UPLOADS_ROOT || !process.env.SOURCE_CMS_ORIGIN)
      throw new Error("缺少 SOURCE_UPLOADS_ROOT / SOURCE_CMS_ORIGIN");
    const report = await importSource(
      getPool(),
      readEnvironment().mediaRoot,
      JSON.parse(await readFile(folder, "utf8")),
      process.env.SOURCE_UPLOADS_ROOT,
      process.env.SOURCE_CMS_ORIGIN,
    );
    const output = `${folder}.report.json`;
    await writeFile(output, JSON.stringify(report, null, 2) + "\n", {
      mode: 0o600,
    });
    console.log(
      `隔离目标导入完成；对账报告：${output}。请检查 readyForCutover 和 limitations。`,
    );
  } else throw new Error("未知迁移命令");
} catch (error) {
  console.error(
    error instanceof Error && !("query" in error)
      ? error.message
      : "迁移/恢复失败，源文件和源数据库未改变。",
  );
  process.exitCode = 1;
} finally {
  await closePool();
}
