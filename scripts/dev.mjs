import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { readBuildEnv, readRuntimeEnv } from "./env.mjs";

export const FIXTURE_PREVIEW_DEFAULTS = Object.freeze({
  CONTENT_SOURCE: "fixture",
  DIRECTUS_PREVIEW_TOKEN: "development-fixture-preview-token-24ch",
  DIRECTUS_URL: "http://127.0.0.1:8055",
  PREVIEW_TRUSTED_HEADER: "development-fixture-preview-header-24ch",
  SITE_URL: "http://localhost:4321",
});

/**
 * Resolves and validates development environment configuration.
 *
 * @param {Record<string, string | undefined>} [env=process.env]
 * @param {{ loadEnv?: boolean; envPath?: string }} [options]
 */
export function resolveDevEnvironment(env = process.env, options = {}) {
  const { loadEnv = true, envPath = resolve(process.cwd(), ".env") } = options;

  if (loadEnv && existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // Ignored if .env cannot be loaded
    }
  }

  const contentSource = env.CONTENT_SOURCE || "fixture";
  if (contentSource === "fixture") {
    for (const [key, value] of Object.entries(FIXTURE_PREVIEW_DEFAULTS)) {
      if (!env[key]) {
        env[key] = value;
      }
    }
  }

  const build = readBuildEnv(env);
  const runtime = readRuntimeEnv(env);

  return { build, runtime };
}

/**
 * Runs a child process and waits for it to exit.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<number>}
 */
function runCommand(command, args, env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
    });

    const forwardSignal = (/** @type {NodeJS.Signals} */ signal) => {
      if (child.pid) {
        child.kill(signal);
      }
    };

    const sigintHandler = () => forwardSignal("SIGINT");
    const sigtermHandler = () => forwardSignal("SIGTERM");

    process.on("SIGINT", sigintHandler);
    process.on("SIGTERM", sigtermHandler);

    child.on("error", (error) => {
      process.off("SIGINT", sigintHandler);
      process.off("SIGTERM", sigtermHandler);
      rejectPromise(error);
    });

    child.on("exit", (code) => {
      process.off("SIGINT", sigintHandler);
      process.off("SIGTERM", sigtermHandler);
      resolvePromise(code ?? 0);
    });
  });
}

/**
 * Main development launcher entrypoint.
 *
 * @param {string[]} [argv=process.argv.slice(2)]
 * @param {Record<string, string | undefined>} [env=process.env]
 */
export async function runDev(argv = process.argv.slice(2), env = process.env) {
  resolveDevEnvironment(env);

  const prepareCode = await runCommand(
    process.execPath,
    ["scripts/prepare-content.ts"],
    env,
  );
  if (prepareCode !== 0) {
    process.exitCode = prepareCode;
    return prepareCode;
  }

  const astroBin = resolve(process.cwd(), "node_modules/.bin/astro");
  const astroCode = await runCommand(astroBin, ["dev", ...argv], env);
  process.exitCode = astroCode;
  return astroCode;
}

const invokedPath = process.argv[1] && pathToFileURL(process.argv[1]).href;
if (invokedPath === import.meta.url) {
  runDev().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
