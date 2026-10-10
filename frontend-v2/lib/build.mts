import { spawn } from "node:child_process";
import { join } from "node:path";
import { readBuildEnvironment } from "./env.js";
import { frontendRoot, withMediaBuild } from "./media-files.js";

const mode = process.argv[2];
if (mode !== "build" && mode !== "dev")
  throw new Error("Expected build or dev");

await withMediaBuild(async () => {
  readBuildEnvironment();
  const child = spawn(
    process.execPath,
    [
      join(frontendRoot, "node_modules/next/dist/bin/next"),
      mode,
      ...(mode === "dev" ? ["-p", "4321"] : []),
      ...process.argv.slice(3),
    ],
    { cwd: frontendRoot, stdio: "inherit" },
  );
  const forward = (signal: NodeJS.Signals) => child.kill(signal);
  const interrupt = () => forward("SIGINT");
  const terminate = () => forward("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  try {
    const code = await new Promise<number>((resolve, reject) => {
      child.once("error", () =>
        reject(new Error("[build] Failed to start Next")),
      );
      child.once("exit", (code) => resolve(code ?? 1));
    });
    process.exitCode = code;
    return mode === "build" && code === 0;
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
});
