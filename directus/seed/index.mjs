import { adminClient, filterPath, isDirectusError } from "../client.mjs";
import { IDS } from "../constants.mjs";
import {
  buildEditorialFixture,
  EDITORIAL_IDS,
  EDITORIAL_SETTINGS,
  LEGACY_FIXTURE_POSTS,
} from "./content.mjs";
import { loadSeedCoverFixture } from "./fixtures.mjs";

const request = await adminClient();

/**
 * @typedef {Record<string, unknown> & { id: string }} DirectusItem
 * @typedef {Record<string, unknown>} DirectusInput
 */

/**
 * @param {DirectusItem} existing
 * @param {DirectusInput} data
 */
function itemMatches(existing, data) {
  return Object.entries(data).every(([field, expected]) => {
    const actual = existing[field];
    return (
      actual === expected ||
      JSON.stringify(actual) === JSON.stringify(expected)
    );
  });
}

/**
 * @param {string} collection
 * @param {string} id
 * @param {DirectusInput} data
 * @returns {Promise<DirectusItem>}
 */
async function upsertItem(collection, id, data) {
  /** @type {DirectusItem | null | undefined} */
  let existing;
  try {
    existing = await request(`/items/${collection}/${id}`);
  } catch (error) {
    if (
      !isDirectusError(error) ||
      (error.status !== 403 && error.status !== 404)
    )
      throw error;
  }

  if (collection === "site_settings") {
    if (existing && itemMatches(existing, data)) return existing;
    return request("/items/site_settings", {
      method: "PATCH",
      body: existing ? data : { id, ...data },
    });
  }
  if (existing) {
    if (itemMatches(existing, data)) return existing;
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
    )
      throw error;
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
    return request(`/files/${existing.id}`, {
      method: "PATCH",
      body: { title, folder },
    });
  }

  const form = new FormData();
  form.set("title", title);
  form.set("folder", folder);
  form.set("file", new Blob([bytes], { type }), filename);
  return request("/files", { method: "POST", body: form });
}

const coverFixture = await loadSeedCoverFixture();
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

const { id: settingsId, ...settings } = EDITORIAL_SETTINGS;
if (settingsId !== EDITORIAL_IDS.settings) {
  throw new Error("Editorial settings ID does not match the seed identity");
}
await upsertItem("site_settings", EDITORIAL_IDS.settings, {
  ...settings,
  avatar: null,
  default_og_image: cover.id,
});

for (const socialLinkId of EDITORIAL_IDS.socialLinks) {
  await deleteKnownItem("social_links", socialLinkId);
}

const editorial = buildEditorialFixture({ coverId: cover.id });
for (const { id: topicId, ...topic } of editorial.topics) {
  await upsertItem("topics", topicId, topic);
}
for (const {
  date_created: _dateCreated,
  date_updated: _dateUpdated,
  id: postId,
  ...post
} of editorial.posts) {
  void _dateCreated;
  void _dateUpdated;
  await upsertItem("posts", postId, post);
}
for (const { id: relationId, ...relation } of editorial.postTopics) {
  await upsertItem("posts_topics", relationId, relation);
}
for (const { id: legacyPostId, ...legacyPost } of LEGACY_FIXTURE_POSTS) {
  await upsertItem("posts", legacyPostId, legacyPost);
}

console.log("Directus editorial fixtures ready");
