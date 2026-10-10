import { adminClient, filterPath, isDirectusError } from "../client.mjs";
import { IDS } from "../constants.mjs";
import {
  EDITORIAL_IDS,
  LEGACY_FIXTURE_POSTS,
  buildLegacyFixtureOriginals,
} from "./content.mjs";
import {
  POST_OWNED_FIELDS,
  POST_TOPIC_OWNED_FIELDS,
  SETTINGS_OWNED_FIELDS,
  TOPIC_OWNED_FIELDS,
  buildFixturePayloads,
  classifyRecordState,
  itemMatchesOwned,
  parseFixtureConfirmation,
} from "./editorial.mjs";
import { loadSeedCoverFixture } from "./fixtures.mjs";

/**
 * @typedef {Record<string, unknown> & { id: string }} DirectusItem
 * @typedef {Record<string, unknown>} DirectusInput
 */

const argv = process.argv.slice(2);
const isDryRun =
  argv.includes("--dry-run") || argv.includes("--preflight-only");
const confirmArg = argv
  .find((arg) => arg.startsWith("--confirm="))
  ?.slice("--confirm=".length);
const confirmation = confirmArg || process.env.FIXTURE_CONFIRM;

const rawDirectusUrl = process.env.DIRECTUS_URL || "http://127.0.0.1:8055";
const targetOrigin = new URL(rawDirectusUrl).origin;

const request = await adminClient();

/**
 * @param {string} collection
 * @param {string} id
 * @returns {Promise<DirectusItem | null>}
 */
async function fetchItem(collection, id) {
  try {
    const item = await request(`/items/${collection}/${id}`);
    return item;
  } catch (error) {
    if (
      isDirectusError(error) &&
      (error.status === 403 || error.status === 404)
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * @param {string} collection
 * @param {string} id
 * @param {DirectusInput} data
 * @param {readonly string[]} ownedFields
 * @returns {Promise<DirectusItem>}
 */
async function upsertItem(collection, id, data, ownedFields) {
  const existing = await fetchItem(collection, id);

  if (collection === "site_settings") {
    if (existing && itemMatchesOwned(existing, { id, ...data }, ownedFields)) {
      return existing;
    }
    return request("/items/site_settings", {
      method: "PATCH",
      body: existing ? data : { id, ...data },
    });
  }

  if (existing) {
    if (itemMatchesOwned(existing, { id, ...data }, ownedFields)) {
      return existing;
    }
    return request(`/items/${collection}/${existing.id}`, {
      method: "PATCH",
      body: data,
    });
  }

  return request(`/items/${collection}`, {
    method: "POST",
    body: { id, ...data },
  });
}

/**
 * @param {string} collection
 * @param {string} id
 */
async function deleteKnownItem(collection, id) {
  try {
    await request(`/items/${collection}/${id}`, { method: "DELETE" });
  } catch (error) {
    if (
      !isDirectusError(error) ||
      (error.status !== 403 && error.status !== 404)
    ) {
      throw error;
    }
  }
}

/**
 * @param {string} title
 * @param {string} folder
 * @param {string} type
 * @param {BlobPart} bytes
 * @param {string} filename
 * @returns {Promise<DirectusItem>}
 */
async function ensureFile(title, folder, type, bytes, filename) {
  /** @type {DirectusItem[]} */
  const [existing] = await request(filterPath("files", "title", title, "*"));
  if (existing) {
    if (existing.folder === folder && existing.title === title) return existing;
    return request(`/files/${existing.id}`, {
      method: "PATCH",
      body: { folder, title },
    });
  }

  const form = new FormData();
  form.set("title", title);
  form.set("folder", folder);
  form.set("file", new Blob([bytes], { type }), filename);
  return request("/files", { method: "POST", body: form });
}

// ---------------------------------------------------------------------------
// Step 1: Preflight classification of known records before any mutation
// ---------------------------------------------------------------------------

const coverFixture = await loadSeedCoverFixture();
const [existingCover] = await request(
  filterPath("files", "title", coverFixture.title, "id"),
);
const fixtureEditorial = buildFixturePayloads({
  coverId: existingCover?.id ?? EDITORIAL_IDS.cover,
});

const existingSettings = await fetchItem(
  "site_settings",
  EDITORIAL_IDS.settings,
);
const settingsState = classifyRecordState(
  existingSettings,
  existingCover ? fixtureEditorial.settings : null,
  null,
  SETTINGS_OWNED_FIELDS,
);

if (settingsState === "owner_modified") {
  throw new Error(
    `Directus contains owner-modified site_settings (${EDITORIAL_IDS.settings}). Fixture install refused before mutation.`,
  );
}

let mutationsNeeded = !existingCover || settingsState === "absent";

for (const topic of fixtureEditorial.topics) {
  const existingTopic = await fetchItem("topics", topic.id);
  const state = classifyRecordState(
    existingTopic,
    topic,
    null,
    TOPIC_OWNED_FIELDS,
  );
  if (state === "owner_modified") {
    throw new Error(
      `Directus contains owner-modified topic (${topic.id} / ${topic.slug}). Fixture install refused before mutation.`,
    );
  }
  if (state === "absent") mutationsNeeded = true;
}

for (const post of fixtureEditorial.posts) {
  const existingPost = await fetchItem("posts", post.id);
  const state = classifyRecordState(
    existingPost,
    existingCover ? post : null,
    null,
    POST_OWNED_FIELDS,
  );
  if (state === "owner_modified") {
    throw new Error(
      `Directus contains owner-modified or launched post (${post.id} / ${post.slug}). Fixture install refused before mutation.`,
    );
  }
  if (state === "absent") mutationsNeeded = true;
}

for (const relation of fixtureEditorial.postTopics) {
  const existingRel = await fetchItem("posts_topics", relation.id);
  const state = classifyRecordState(
    existingRel,
    relation,
    null,
    POST_TOPIC_OWNED_FIELDS,
  );
  if (state === "owner_modified") {
    throw new Error(
      `Directus contains modified posts_topics relation (${relation.id}). Fixture install refused before mutation.`,
    );
  }
  if (state === "absent") mutationsNeeded = true;
}

const legacyOriginals = buildLegacyFixtureOriginals({
  coverId: existingCover?.id ?? null,
});
for (const post of LEGACY_FIXTURE_POSTS) {
  const existing = await fetchItem("posts", post.id);
  const original = legacyOriginals.find(
    (candidate) => candidate.id === post.id,
  );
  const state = classifyRecordState(
    existing,
    original,
    post,
    POST_OWNED_FIELDS,
  );
  if (state === "owner_modified") {
    throw new Error(
      `Directus contains owner-modified legacy post (${post.id}). Fixture install refused before mutation.`,
    );
  }
  if (state !== "exact_manifest") mutationsNeeded = true;
}

if (!mutationsNeeded) {
  console.log(
    `Directus fixtures at ${targetOrigin} already match exact deterministic fixtures. No mutations performed.`,
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Step 2: Verification of confirmation
// ---------------------------------------------------------------------------

if (isDryRun) {
  console.log(
    `[DRY RUN] Preflight passed. Fixture installation would apply mutations to ${targetOrigin}.`,
  );
  process.exit(0);
}

const isConfirmed = parseFixtureConfirmation(confirmation, targetOrigin);
if (!isConfirmed) {
  const expectedToken = `CONFIRM_FIXTURE_INSTALL_${targetOrigin}`;
  console.error(
    `Fixture installation requires explicit target confirmation.\n` +
      `To install development fixtures into ${targetOrigin}, run:\n` +
      `  node directus/seed/index.mjs --confirm=${expectedToken}\n` +
      `or set environment variable:\n` +
      `  FIXTURE_CONFIRM=${expectedToken}`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 3: Mutate in dependency order
// ---------------------------------------------------------------------------

const cover = await ensureFile(
  coverFixture.title,
  IDS.folders.publishable,
  coverFixture.mimeType,
  coverFixture.bytes,
  coverFixture.filename,
);

await ensureFile(
  "示例私有草稿图（非真实内容）",
  IDS.folders.private,
  "image/svg+xml",
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#dce8f5"/><text x="24" y="96" font-family="sans-serif" font-size="24" fill="#174b78">DRAFT FIXTURE</text></svg>',
  "fixture-draft.svg",
);

const editorial = buildFixturePayloads({ coverId: cover.id });
const { id: settingsId, ...settings } = editorial.settings;
const preserveAvatar = existingSettings?.avatar ?? null;
await upsertItem(
  "site_settings",
  settingsId,
  {
    ...settings,
    avatar: preserveAvatar,
  },
  SETTINGS_OWNED_FIELDS,
);

for (const socialLinkId of EDITORIAL_IDS.socialLinks) {
  await deleteKnownItem("social_links", socialLinkId);
}

for (const { id: topicId, ...topic } of editorial.topics) {
  await upsertItem("topics", topicId, topic, TOPIC_OWNED_FIELDS);
}

for (const {
  date_created: _dc,
  date_updated: _du,
  id: postId,
  ...post
} of editorial.posts) {
  void _dc;
  void _du;
  await upsertItem("posts", postId, post, POST_OWNED_FIELDS);
}

for (const { id: relationId, ...relation } of editorial.postTopics) {
  await upsertItem(
    "posts_topics",
    relationId,
    relation,
    POST_TOPIC_OWNED_FIELDS,
  );
}

for (const { id: legacyPostId, ...legacyPost } of LEGACY_FIXTURE_POSTS) {
  await upsertItem("posts", legacyPostId, legacyPost, POST_OWNED_FIELDS);
}

console.log(
  `Directus editorial fixtures ready on ${targetOrigin} (${editorial.posts.length} posts, ${editorial.topics.length} topics, ${editorial.postTopics.length} joins)`,
);
