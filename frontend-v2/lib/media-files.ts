import { randomUUID } from "node:crypto";
import { lstat, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export function mediaPaths(root = frontendRoot) {
  const packageRoot = resolve(root);
  return {
    root: packageRoot,
    public: join(packageRoot, "public"),
    output: join(packageRoot, "public", "_cms"),
    staging: join(packageRoot, ".cms-staging"),
    lock: join(packageRoot, ".cms-build.lock"),
  };
}
export type MediaPaths = ReturnType<typeof mediaPaths>;

async function directoryOnly(path: string, missing = false) {
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if (
      missing &&
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return;
  }
  if (!info?.isDirectory() || info.isSymbolicLink()) {
    throw new Error(
      "[media] Generated media directory must be a real directory",
    );
  }
}

async function validatePaths(paths: MediaPaths) {
  const expected = mediaPaths(paths.root);
  for (const key of ["public", "output", "staging", "lock"] as const) {
    if (paths[key] !== expected[key])
      throw new Error("[media] Invalid owned media path");
  }
  await directoryOnly(paths.root);
  await directoryOnly(paths.public);
  await directoryOnly(paths.output, true);
  await directoryOnly(paths.staging, true);
}

/** Called by the single build/dev wrapper, never by a Next worker. */
export async function resetGeneratedMedia(paths = mediaPaths()) {
  await validatePaths(paths);
  await rm(paths.output, { recursive: true, force: true });
  await rm(paths.staging, { recursive: true, force: true });
  await mkdir(paths.output);
  await mkdir(paths.staging);
}

export async function acquireMediaBuild(paths = mediaPaths()) {
  await validatePaths(paths);
  try {
    await mkdir(paths.lock);
  } catch {
    throw new Error(
      "[media] Another build/dev process owns this checkout; release its lock before retrying",
    );
  }
  return async () => {
    await directoryOnly(paths.lock);
    await rm(paths.lock, { recursive: true });
  };
}

/** Own the complete build/dev lifetime, including exceptions and failed output. */
export async function withMediaBuild(
  action: () => Promise<boolean>,
  paths = mediaPaths(),
) {
  const release = await acquireMediaBuild(paths);
  let succeeded = false;
  try {
    await resetGeneratedMedia(paths);
    succeeded = await action();
    return succeeded;
  } finally {
    try {
      if (!succeeded) await resetGeneratedMedia(paths);
    } finally {
      await release();
    }
  }
}

/** Stage outside public; rename only complete verified immutable bytes. */
export async function publishMedia(
  filename: string,
  bytes: Uint8Array,
  paths = mediaPaths(),
) {
  if (!/^[a-f0-9]{64}\.(?:jpg|png|webp|gif|avif)$/.test(filename)) {
    throw new Error("[media] Invalid content-addressed filename");
  }
  await validatePaths(paths);
  await mkdir(paths.output, { recursive: true });
  await mkdir(paths.staging, { recursive: true });
  const temporary = join(paths.staging, randomUUID());
  try {
    await writeFile(temporary, bytes, { flag: "wx", mode: 0o644 });
    await rename(temporary, join(paths.output, filename));
  } catch {
    throw new Error("[media] Failed to publish verified public media");
  } finally {
    await rm(temporary, { force: true });
  }
}
