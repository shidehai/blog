import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  mediaPaths,
  publishMedia,
  resetGeneratedMedia,
  withMediaBuild,
} from "./media-files.js";

const root = await mkdtemp(join(tmpdir(), "blog-media-lifecycle-"));
const paths = mediaPaths(root);
const bytes = Buffer.from("verified-test-bytes");
const filename = `${createHash("sha256").update(bytes).digest("hex")}.png`;
try {
  await mkdir(paths.public);
  const avatar = join(paths.public, "avatar.svg");
  await writeFile(avatar, "authored-original");
  await resetGeneratedMedia(paths);
  await writeFile(join(paths.output, "stale.webp"), "stale");
  await writeFile(join(paths.staging, "abandoned"), "partial");
  let ran = false;
  await withMediaBuild(async () => {
    ran = true;
    assert.deepEqual(await readdir(paths.output), []);
    assert.deepEqual(await readdir(paths.staging), []);
    assert.equal(await readFile(avatar, "utf8"), "authored-original");
    return true; // A fixture build leaves an empty namespace.
  }, paths);
  assert.equal(ran, true);
  await assert.rejects(lstat(paths.lock), { code: "ENOENT" });

  for (const throws of [false, true]) {
    const action = () =>
      withMediaBuild(async () => {
        await publishMedia(filename, bytes, paths);
        assert.deepEqual(await readFile(join(paths.output, filename)), bytes);
        if (throws) throw new Error("Next build failed");
        return false;
      }, paths);
    if (throws) await assert.rejects(action, /Next build failed/);
    else assert.equal(await action(), false);
    assert.deepEqual(await readdir(paths.output), []);
    assert.deepEqual(await readdir(paths.staging), []);
    await assert.rejects(lstat(paths.lock), { code: "ENOENT" });
  }

  let unlock!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const first = withMediaBuild(async () => {
    entered();
    await gate;
    return true;
  }, paths);
  await started;
  await assert.rejects(
    withMediaBuild(async () => {
      throw new Error("must not run");
    }, paths),
    /Another build\/dev/,
  );
  unlock();
  await first;

  await Promise.all(
    Array.from({ length: 8 }, () => publishMedia(filename, bytes, paths)),
  );
  assert.deepEqual(await readdir(paths.output), [filename]);
  assert.deepEqual(await readFile(join(paths.output, filename)), bytes);
  assert.deepEqual(await readdir(paths.staging), []);
  await assert.rejects(publishMedia("../avatar.svg", bytes, paths), /filename/);

  await resetGeneratedMedia(paths);
  const workerScript = `import { publishMedia, mediaPaths } from ${JSON.stringify(new URL("./media-files.ts", import.meta.url).href)};
await publishMedia(process.argv[2], Buffer.from(process.argv[3], "base64"), mediaPaths(process.argv[1]));`;
  await Promise.all(
    Array.from(
      { length: 4 },
      () =>
        new Promise<void>((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              "--import",
              "tsx",
              "--input-type",
              "module",
              "--eval",
              workerScript,
              "--",
              root,
              filename,
              bytes.toString("base64"),
            ],
            { stdio: "pipe" },
          );
          child.once("error", reject);
          child.once("exit", (code) =>
            code === 0
              ? resolve()
              : reject(new Error(`Publication worker failed (${code})`)),
          );
        }),
    ),
  );
  assert.deepEqual(await readdir(paths.output), [filename]);
  assert.deepEqual(await readFile(join(paths.output, filename)), bytes);
  assert.deepEqual(await readdir(paths.staging), []);

  const elsewhere = join(root, "untouched");
  await mkdir(elsewhere);
  await writeFile(join(elsewhere, "sentinel"), "keep");
  for (const namespace of [paths.output, paths.staging]) {
    await rm(namespace, { recursive: true });
    await symlink(elsewhere, namespace, "dir");
    await assert.rejects(resetGeneratedMedia(paths), /real directory/);
    await assert.rejects(
      publishMedia(filename, bytes, paths),
      /real directory/,
    );
    assert.equal(await readFile(join(elsewhere, "sentinel"), "utf8"), "keep");
    await rm(namespace);
    await mkdir(namespace);
  }
  await assert.rejects(
    resetGeneratedMedia({ ...paths, output: elsewhere }),
    /owned media path/,
  );
  assert.equal(await readFile(avatar, "utf8"), "authored-original");
  const authored = join(root, "authored-public");
  await rename(paths.public, authored);
  await symlink(elsewhere, paths.public, "dir");
  await assert.rejects(resetGeneratedMedia(paths), /real directory/);
  assert.equal(await readFile(join(elsewhere, "sentinel"), "utf8"), "keep");
  await rm(paths.public);
  await rename(authored, paths.public);
  assert.equal(await readFile(avatar, "utf8"), "authored-original");
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log(
  "media lifecycle check ok: cleanup, failure, locking, atomic writes and symlink refusal",
);
