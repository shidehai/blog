import { pathToFileURL } from "node:url";

import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);

const buildSchema = z
  .object({
    CONTENT_SOURCE: z.enum(["fixture", "directus"]).default("fixture"),
    DIRECTUS_BUILD_TOKEN: z.string().min(24).optional(),
    DIRECTUS_URL: optionalUrl,
    SITE_URL: z.url().default("http://localhost:4321"),
  })
  .superRefine((env, context) => {
    if (env.CONTENT_SOURCE !== "directus") return;

    if (!env.DIRECTUS_URL) {
      context.addIssue({
        code: "custom",
        message: "is required when CONTENT_SOURCE=directus",
        path: ["DIRECTUS_URL"],
      });
    }
    if (!env.DIRECTUS_BUILD_TOKEN) {
      context.addIssue({
        code: "custom",
        message: "is required when CONTENT_SOURCE=directus",
        path: ["DIRECTUS_BUILD_TOKEN"],
      });
    }
  });

const runtimeSchema = z.object({
  DIRECTUS_PREVIEW_TOKEN: z.string().min(24),
  DIRECTUS_URL: z.url(),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4321),
  PREVIEW_TRUSTED_HEADER: z.string().min(24),
  SITE_URL: z.url(),
});

/**
 * @template T
 * @param {z.ZodType<T>} schema
 * @param {unknown} input
 * @param {string} mode
 * @returns {T}
 */
function parse(schema, input, mode) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const details = result.error.issues
    .map(
      (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
    )
    .join("; ");
  throw new Error(`Invalid ${mode} environment: ${details}`);
}

export function readBuildEnv(input = process.env) {
  return parse(buildSchema, input, "build");
}

export function readRuntimeEnv(input = process.env) {
  return parse(runtimeSchema, input, "runtime");
}

const invokedPath = process.argv[1] && pathToFileURL(process.argv[1]).href;
if (invokedPath === import.meta.url) {
  const mode = process.argv[2];
  try {
    if (mode === "build") readBuildEnv();
    else if (mode === "runtime") readRuntimeEnv();
    else throw new Error("Usage: node scripts/env.mjs <build|runtime>");
    console.log(`${mode} environment is valid`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
