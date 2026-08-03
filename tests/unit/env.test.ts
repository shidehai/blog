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
});
