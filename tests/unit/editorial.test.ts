import { describe, expect, it } from "vitest";

import {
  EDITORIAL_IDS,
  EDITORIAL_SETTINGS,
  buildEditorialFixture,
} from "../../directus/seed/content.mjs";
import {
  SETTINGS_OWNED_FIELDS,
  buildLaunchManifest,
  canonicalJson,
  classifyRecordState,
  createStableDigest,
  generateLaunchSchedule,
  itemMatchesOwned,
  parseFixtureConfirmation,
  parseLaunchConfirmation,
} from "../../directus/seed/editorial.mjs";

describe("editorial planning and classification", () => {
  const baseLaunchTime = "2026-08-19T12:00:00.000Z";
  const directusUrl = "http://127.0.0.1:8055";

  it("generates strictly descending unique launch timestamps", () => {
    const schedule = generateLaunchSchedule(baseLaunchTime, 12, 60);

    expect(schedule).toHaveLength(12);
    expect(schedule[0]).toBe(baseLaunchTime);

    for (let i = 1; i < schedule.length; i += 1) {
      const prev = schedule[i - 1];
      const curr = schedule[i];
      if (!prev || !curr) throw new Error("Missing timestamp in schedule");
      const prevMs = new Date(prev).getTime();
      const currMs = new Date(curr).getTime();
      expect(prevMs).toBeGreaterThan(currMs);
      expect(prevMs - currMs).toBe(60_000);
    }
  });

  it("rejects invalid base launch time formats", () => {
    expect(() => generateLaunchSchedule("not-a-date")).toThrow(
      "Invalid baseLaunchTime",
    );
    expect(() => generateLaunchSchedule("2026-08-19 12:00:00")).toThrow(
      "Invalid baseLaunchTime",
    );
  });

  it("produces deterministic canonical json independent of property order", () => {
    const objA = { a: 1, b: "hello", nested: { y: 2, z: 3 } };
    const objB = { nested: { z: 3, y: 2 }, b: "hello", a: 1 };

    expect(canonicalJson(objA)).toBe(canonicalJson(objB));
    expect(createStableDigest(objA)).toBe(createStableDigest(objB));
  });

  it("builds a stable, reproducible launch manifest with digests", () => {
    const manifest1 = buildLaunchManifest({
      baseLaunchTime,
      coverId: EDITORIAL_IDS.cover,
      directusUrl,
    });
    const manifest2 = buildLaunchManifest({
      baseLaunchTime,
      coverId: EDITORIAL_IDS.cover,
      directusUrl,
    });

    expect(manifest1.manifestDigest).toBe(manifest2.manifestDigest);
    expect(manifest1.posts).toHaveLength(12);
    expect(manifest1.topics).toHaveLength(6);
    expect(manifest1.postTopics).toHaveLength(28);
    expect(manifest1.targetOrigin).toBe("http://127.0.0.1:8055");
  });

  it("classifies absent, fixture, manifest, and owner-modified states accurately", () => {
    const fixture = buildEditorialFixture({ coverId: EDITORIAL_IDS.cover });
    const post0 = fixture.posts[0];
    const ownedFields = [
      "title",
      "slug",
      "summary",
      "body",
      "published_at",
      "status",
    ];

    const launchManifest = buildLaunchManifest({
      baseLaunchTime,
      coverId: EDITORIAL_IDS.cover,
      directusUrl,
    });
    const launchPost0PublishedAt = launchManifest.posts[0]?.published_at;
    if (!launchPost0PublishedAt)
      throw new Error("Missing post 0 in launch manifest");
    const launchPost0 = {
      ...post0,
      published_at: launchPost0PublishedAt,
    };

    expect(classifyRecordState(null, post0, launchPost0, ownedFields)).toBe(
      "absent",
    );

    expect(classifyRecordState(post0, post0, launchPost0, ownedFields)).toBe(
      "exact_fixture",
    );

    expect(
      classifyRecordState(launchPost0, post0, launchPost0, ownedFields),
    ).toBe("exact_manifest");

    const ownerModified = { ...launchPost0, title: "Owner Changed Title" };
    expect(
      classifyRecordState(ownerModified, post0, launchPost0, ownedFields),
    ).toBe("owner_modified");
  });

  it("preserves owner avatar and non-owned fields during settings comparison", () => {
    const settings = { ...EDITORIAL_SETTINGS };
    delete (settings as { id?: string }).id;
    const fixtureSettings = {
      ...settings,
      avatar: null,
      default_og_image: EDITORIAL_IDS.cover,
    };

    const ownerSettingsWithAvatar = {
      ...fixtureSettings,
      avatar: "custom-owner-avatar-uuid-12345",
      custom_extra_field: "extra",
    };

    expect(
      itemMatchesOwned(
        ownerSettingsWithAvatar,
        fixtureSettings,
        SETTINGS_OWNED_FIELDS,
      ),
    ).toBe(true);
  });

  it("validates fixture confirmation strings strictly", () => {
    const targetOrigin = "http://127.0.0.1:8055";
    const valid = "CONFIRM_FIXTURE_INSTALL_http://127.0.0.1:8055";

    expect(parseFixtureConfirmation(valid, targetOrigin)).toBe(true);
    expect(
      parseFixtureConfirmation(
        "CONFIRM_FIXTURE_INSTALL_http://wrong.com",
        targetOrigin,
      ),
    ).toBe(false);
    expect(parseFixtureConfirmation("yes", targetOrigin)).toBe(false);
  });

  it("validates launch confirmation strings strictly", () => {
    const targetOrigin = "http://127.0.0.1:8055";
    const digest =
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const valid = `CONFIRM_LAUNCH_${digest}_FOR_http://127.0.0.1:8055`;

    expect(parseLaunchConfirmation(valid, digest, targetOrigin)).toBe(true);
    expect(
      parseLaunchConfirmation(
        `CONFIRM_LAUNCH_different_digest_FOR_${targetOrigin}`,
        digest,
        targetOrigin,
      ),
    ).toBe(false);
    expect(parseLaunchConfirmation("yes", digest, targetOrigin)).toBe(false);
  });
});
