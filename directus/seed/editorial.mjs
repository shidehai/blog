import { createHash } from "node:crypto";

import {
  buildEditorialFixture,
  EDITORIAL_IDS,
  EDITORIAL_SETTINGS,
} from "./content.mjs";

export const SETTINGS_OWNED_FIELDS = Object.freeze([
  "default_og_image",
  "footer_note",
  "locale",
  "seo_description",
  "seo_title",
  "site_author",
  "site_description",
  "site_name",
  "timezone",
]);

export const TOPIC_OWNED_FIELDS = Object.freeze([
  "description",
  "id",
  "name",
  "slug",
]);

export const POST_OWNED_FIELDS = Object.freeze([
  "body",
  "cover_alt",
  "cover_decorative",
  "cover_image",
  "featured",
  "id",
  "kind",
  "published_at",
  "seo_description",
  "seo_title",
  "slug",
  "status",
  "summary",
  "title",
]);

export const POST_TOPIC_OWNED_FIELDS = Object.freeze([
  "id",
  "posts_id",
  "topics_id",
]);

/**
 * Deterministically serializes any JSON-compatible value with sorted keys.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((element) => canonicalJson(element)).join(",")}]`;
  }
  const entries = Object.entries(value).sort(([keyA], [keyB]) =>
    keyA.localeCompare(keyB),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/**
 * Computes a hex SHA-256 digest of a value.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function createStableDigest(value) {
  const json = typeof value === "string" ? value : canonicalJson(value);
  return createHash("sha256").update(json, "utf8").digest("hex");
}

/**
 * Generates unique, strictly descending publication timestamps around a UTC base time.
 * The order matches the canonical post array so sorting by -published_at preserves array order.
 *
 * @param {string} baseLaunchTime ISO-8601 UTC timestamp string
 * @param {number} [count=12]
 * @param {number} [stepSeconds=60]
 * @returns {string[]}
 */
export function generateLaunchSchedule(
  baseLaunchTime,
  count = 12,
  stepSeconds = 60,
) {
  if (
    typeof baseLaunchTime !== "string" ||
    !baseLaunchTime.endsWith("Z") ||
    Number.isNaN(Date.parse(baseLaunchTime))
  ) {
    throw new Error(
      `Invalid baseLaunchTime: must be a valid ISO-8601 UTC string (e.g. 2026-08-19T12:00:00.000Z)`,
    );
  }

  const baseMs = new Date(baseLaunchTime).getTime();
  const schedule = [];
  for (let i = 0; i < count; i += 1) {
    const timestampMs = baseMs - i * stepSeconds * 1000;
    schedule.push(new Date(timestampMs).toISOString());
  }
  return schedule;
}

/**
 * @param {Record<string, unknown> | null | undefined} existing
 * @param {Record<string, unknown> | null | undefined} target
 * @param {readonly string[]} ownedFields
 * @returns {boolean}
 */
export function itemMatchesOwned(existing, target, ownedFields) {
  if (!existing || !target) return false;
  return ownedFields.every((field) => {
    const actual = existing[field];
    const expected = target[field];
    return (
      actual === expected || canonicalJson(actual) === canonicalJson(expected)
    );
  });
}

/**
 * Classifies an existing Directus record relative to fixture and launch manifest targets.
 *
 * @param {Record<string, unknown> | null | undefined} existing
 * @param {Record<string, unknown> | null | undefined} fixturePayload
 * @param {Record<string, unknown> | null | undefined} launchPayload
 * @param {readonly string[]} ownedFields
 * @returns {"absent" | "exact_fixture" | "exact_manifest" | "owner_modified"}
 */
export function classifyRecordState(
  existing,
  fixturePayload,
  launchPayload,
  ownedFields,
) {
  if (!existing) return "absent";
  if (launchPayload && itemMatchesOwned(existing, launchPayload, ownedFields)) {
    return "exact_manifest";
  }
  if (
    fixturePayload &&
    itemMatchesOwned(existing, fixturePayload, ownedFields)
  ) {
    return "exact_fixture";
  }
  return "owner_modified";
}

/**
 * Builds a reproducible, secret-free launch manifest.
 *
 * @param {{
 *   baseLaunchTime: string;
 *   directusUrl: string;
 *   coverId: string;
 * }} options
 */
export function buildLaunchManifest({
  baseLaunchTime,
  directusUrl,
  coverId = EDITORIAL_IDS.cover,
}) {
  const url = new URL(directusUrl);
  const targetOrigin = url.origin;

  const schedule = generateLaunchSchedule(baseLaunchTime, 12, 60);
  const publishedAtMap = new Map();

  const fixtureEditorial = buildEditorialFixture({ coverId });
  fixtureEditorial.posts.forEach((post, index) => {
    publishedAtMap.set(post.id, schedule[index]);
  });

  const launchEditorial = buildEditorialFixture({
    coverId,
    publishedAtMap,
  });

  const { id: settingsId, ...settingsData } = EDITORIAL_SETTINGS;
  const launchSettings = {
    ...settingsData,
    default_og_image: coverId,
    id: settingsId,
  };

  const manifestPayloads = {
    baseLaunchTime,
    posts: launchEditorial.posts.map((post) => ({
      digest: createStableDigest(
        Object.fromEntries(
          POST_OWNED_FIELDS.map((field) => [
            field,
            /** @type {Record<string, unknown>} */ (post)[field],
          ]),
        ),
      ),
      id: post.id,
      published_at: post.published_at,
      slug: post.slug,
      title: post.title,
    })),
    postTopics: launchEditorial.postTopics.map((relation) => ({
      digest: createStableDigest(relation),
      id: relation.id,
      posts_id: relation.posts_id,
      topics_id: relation.topics_id,
    })),
    settings: {
      digest: createStableDigest(
        Object.fromEntries(
          SETTINGS_OWNED_FIELDS.map((field) => [
            field,
            /** @type {Record<string, unknown>} */ (launchSettings)[field],
          ]),
        ),
      ),
      id: settingsId,
    },
    targetOrigin,
    topics: launchEditorial.topics.map((topic) => ({
      digest: createStableDigest(
        Object.fromEntries(
          TOPIC_OWNED_FIELDS.map((field) => [
            field,
            /** @type {Record<string, unknown>} */ (topic)[field],
          ]),
        ),
      ),
      id: topic.id,
      name: topic.name,
      slug: topic.slug,
    })),
    version: "1.0",
  };

  const manifestDigest = createStableDigest(manifestPayloads);

  return {
    ...manifestPayloads,
    manifestDigest,
  };
}

/**
 * Validates fixture installation confirmation.
 *
 * @param {string | undefined} input
 * @param {string} targetOrigin
 * @returns {boolean}
 */
export function parseFixtureConfirmation(input, targetOrigin) {
  if (!input || typeof input !== "string") return false;
  const normalizedOrigin = new URL(targetOrigin).origin;
  const expectedPrefix = "CONFIRM_FIXTURE_INSTALL_";
  return input === `${expectedPrefix}${normalizedOrigin}`;
}

/**
 * Validates launch apply confirmation.
 *
 * @param {string | undefined} input
 * @param {string} manifestDigest
 * @param {string} targetOrigin
 * @returns {boolean}
 */
export function parseLaunchConfirmation(input, manifestDigest, targetOrigin) {
  if (!input || typeof input !== "string" || !manifestDigest) return false;
  const normalizedOrigin = new URL(targetOrigin).origin;
  const expected = `CONFIRM_LAUNCH_${manifestDigest}_FOR_${normalizedOrigin}`;
  return input === expected;
}
