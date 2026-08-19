import { describe, expect, it } from "vitest";

import {
  FIXTURE_PREVIEW_DEFAULTS,
  resolveDevEnvironment,
} from "../../scripts/dev.mjs";
import { readBuildEnv, readRuntimeEnv } from "../../scripts/env.mjs";

describe("environment validation", () => {
  it("allows fixture builds without credentials", () => {
    expect(readBuildEnv({}).CONTENT_SOURCE).toBe("fixture");
  });

  it("requires a token for Directus builds", () => {
    expect(() =>
      readBuildEnv({
        CONTENT_SOURCE: "directus",
        DIRECTUS_URL: "https://cms.example.com",
      }),
    ).toThrow("DIRECTUS_BUILD_TOKEN");
  });

  it("rejects incomplete runtime configuration", () => {
    expect(() => readRuntimeEnv({ SITE_URL: "https://example.com" })).toThrow(
      "DIRECTUS_PREVIEW_TOKEN",
    );
  });

  it("requires an explicit runtime content source", () => {
    const runtime = {
      DIRECTUS_PREVIEW_TOKEN: "preview-token-at-least-24-characters",
      DIRECTUS_URL: "https://cms.example.com",
      PREVIEW_TRUSTED_HEADER: "trusted-header-at-least-24-characters",
      SITE_URL: "https://example.com",
    };

    expect(() => readRuntimeEnv(runtime)).toThrow("CONTENT_SOURCE");
    expect(
      readRuntimeEnv({ ...runtime, CONTENT_SOURCE: "fixture" }),
    ).toMatchObject({ CONTENT_SOURCE: "fixture" });
    expect(
      readRuntimeEnv({ ...runtime, CONTENT_SOURCE: "directus" }),
    ).toMatchObject({ CONTENT_SOURCE: "directus" });
  });

  it("supplies complete fixture defaults for local dev entrypoint", () => {
    const customEnv: Record<string, string | undefined> = {};
    const { build, runtime } = resolveDevEnvironment(customEnv, {
      loadEnv: false,
    });

    expect(build.CONTENT_SOURCE).toBe("fixture");
    expect(runtime.CONTENT_SOURCE).toBe("fixture");
    expect(runtime.DIRECTUS_URL).toBe(FIXTURE_PREVIEW_DEFAULTS.DIRECTUS_URL);
    expect(runtime.DIRECTUS_PREVIEW_TOKEN).toBe(
      FIXTURE_PREVIEW_DEFAULTS.DIRECTUS_PREVIEW_TOKEN,
    );
    expect(runtime.PREVIEW_TRUSTED_HEADER).toBe(
      FIXTURE_PREVIEW_DEFAULTS.PREVIEW_TRUSTED_HEADER,
    );
    expect(runtime.SITE_URL).toBe(FIXTURE_PREVIEW_DEFAULTS.SITE_URL);
  });

  it("preserves explicit custom values when resolving dev environment", () => {
    const customEnv = {
      CONTENT_SOURCE: "fixture",
      DIRECTUS_PREVIEW_TOKEN: "custom-preview-token-at-least-24-chars",
      DIRECTUS_URL: "http://127.0.0.1:9055",
      PREVIEW_TRUSTED_HEADER: "custom-trusted-header-at-least-24-chars",
      SITE_URL: "http://localhost:5000",
    };
    const { runtime } = resolveDevEnvironment(customEnv, { loadEnv: false });

    expect(runtime.SITE_URL).toBe("http://localhost:5000");
    expect(runtime.DIRECTUS_URL).toBe("http://127.0.0.1:9055");
    expect(runtime.DIRECTUS_PREVIEW_TOKEN).toBe(
      "custom-preview-token-at-least-24-chars",
    );
    expect(runtime.PREVIEW_TRUSTED_HEADER).toBe(
      "custom-trusted-header-at-least-24-chars",
    );
  });

  it("fails dev environment resolution when directus mode is missing credentials", () => {
    const directusEnv = { CONTENT_SOURCE: "directus" };
    expect(() =>
      resolveDevEnvironment(directusEnv, { loadEnv: false }),
    ).toThrow("DIRECTUS_URL");
  });
});
