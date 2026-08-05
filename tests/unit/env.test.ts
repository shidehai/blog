import { describe, expect, it } from "vitest";

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
});
