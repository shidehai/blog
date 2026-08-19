import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { adminClient, filterPath, isDirectusError } from "./client.mjs";
import { IDS } from "./constants.mjs";
import {
  buildEditorialFixture,
  EDITORIAL_IDS,
  EDITORIAL_SETTINGS,
  LEGACY_FIXTURE_POSTS,
} from "./seed/content.mjs";
import {
  POST_OWNED_FIELDS,
  POST_TOPIC_OWNED_FIELDS,
  SETTINGS_OWNED_FIELDS,
  TOPIC_OWNED_FIELDS,
  buildLaunchManifest,
  classifyRecordState,
  createStableDigest,
  itemMatchesOwned,
  parseLaunchConfirmation,
} from "./seed/editorial.mjs";
import { loadSeedCoverFixture } from "./seed/fixtures.mjs";

/**
 * @typedef {Record<string, unknown> & { id: string }} DirectusItem
 */

const argv = process.argv.slice(2);
const command = argv[0];

function parseArg(/** @type {string} */ name) {
  const prefix = `--${name}=`;
  const match = argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

/**
 * @param {ReturnType<typeof import("./client.mjs").directusClient>} request
 * @param {string} collection
 * @param {string} id
 * @returns {Promise<DirectusItem | null>}
 */
async function fetchItem(request, collection, id) {
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
 * @param {ReturnType<typeof import("./client.mjs").directusClient>} request
 * @param {string} collection
 * @param {string} id
 * @param {Record<string, unknown>} data
 * @param {readonly string[]} ownedFields
 * @returns {Promise<DirectusItem>}
 */
async function upsertItem(request, collection, id, data, ownedFields) {
  const existing = await fetchItem(request, collection, id);

  if (collection === "site_settings") {
    if (existing && itemMatchesOwned(existing, data, ownedFields)) {
      return existing;
    }
    return request("/items/site_settings", {
      method: "PATCH",
      body: existing ? data : { id, ...data },
    });
  }

  if (existing) {
    if (itemMatchesOwned(existing, data, ownedFields)) {
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
 * @param {ReturnType<typeof import("./client.mjs").directusClient>} request
 * @param {string} title
 * @param {string} folder
 * @param {string} type
 * @param {BlobPart} bytes
 * @param {string} filename
 * @returns {Promise<DirectusItem>}
 */
async function ensureFile(request, title, folder, type, bytes, filename) {
  /** @type {DirectusItem[]} */
  const [existing] = await request(filterPath("files", "title", title, "*"));
  if (existing) {
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

async function handlePlan() {
  const baseTimeArg = parseArg("base-time") || new Date().toISOString();
  const outputPath =
    parseArg("output") ||
    resolve(process.cwd(), ".generated/launch-manifest.json");

  const rawUrl = process.env.DIRECTUS_URL || "http://127.0.0.1:8055";
  const manifest = buildLaunchManifest({
    baseLaunchTime: baseTimeArg,
    coverId: EDITORIAL_IDS.cover,
    directusUrl: rawUrl,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(outputPath, 0o600).catch(() => {});

  console.log("=== Editorial Launch Plan Generated ===");
  console.log(`Target Directus Origin: ${manifest.targetOrigin}`);
  console.log(`Base Launch Timestamp:  ${manifest.baseLaunchTime}`);
  console.log(`Canonical Posts Count:  ${manifest.posts.length}`);
  console.log(`Manifest Digest:        ${manifest.manifestDigest}`);
  console.log(`Manifest Saved To:      ${outputPath}`);
  console.log("\nTo apply this launch plan, execute:");
  console.log(
    `  node directus/launch.mjs apply --manifest=${outputPath} --confirm=CONFIRM_LAUNCH_${manifest.manifestDigest}_FOR_${manifest.targetOrigin}`,
  );
}

async function handleApply() {
  const manifestPath = parseArg("manifest");
  if (!manifestPath) {
    throw new Error("Missing required argument: --manifest=<path>");
  }

  const confirmation = parseArg("confirm") || process.env.LAUNCH_CONFIRM;
  const manifestContent = await readFile(resolve(manifestPath), "utf8");
  const manifest = JSON.parse(manifestContent);

  const { manifestDigest, ...payloadWithoutDigest } = manifest;
  const computedDigest = createStableDigest(payloadWithoutDigest);

  if (computedDigest !== manifestDigest) {
    throw new Error(
      "Manifest digest mismatch: the file content has been altered or corrupted.",
    );
  }

  const isConfirmed = parseLaunchConfirmation(
    confirmation,
    manifestDigest,
    manifest.targetOrigin,
  );

  if (!isConfirmed) {
    const expected = `CONFIRM_LAUNCH_${manifestDigest}_FOR_${manifest.targetOrigin}`;
    console.error(
      `Launch apply requires explicit confirmation.\n` +
        `Run:\n` +
        `  node directus/launch.mjs apply --manifest=${manifestPath} --confirm=${expected}`,
    );
    process.exit(1);
  }

  const request = await adminClient();

  // -------------------------------------------------------------------------
  // Preflight check against current Directus state
  // -------------------------------------------------------------------------
  const coverFixture = await loadSeedCoverFixture();
  const fixtureEditorial = buildEditorialFixture({
    coverId: EDITORIAL_IDS.cover,
  });

  const publishedAtMap = new Map(
    manifest.posts.map(
      (/** @type {{ id: string; published_at: string }} */ p) => [
        p.id,
        p.published_at,
      ],
    ),
  );
  const launchEditorial = buildEditorialFixture({
    coverId: EDITORIAL_IDS.cover,
    publishedAtMap,
  });

  const { id: settingsId, ...settingsData } = EDITORIAL_SETTINGS;
  const launchSettings = {
    ...settingsData,
    default_og_image: EDITORIAL_IDS.cover,
    id: settingsId,
  };

  const existingSettings = await fetchItem(
    request,
    "site_settings",
    settingsId,
  );
  const settingsState = classifyRecordState(
    existingSettings,
    EDITORIAL_SETTINGS,
    launchSettings,
    SETTINGS_OWNED_FIELDS,
  );

  if (settingsState === "owner_modified") {
    throw new Error(
      `Preflight failed: site_settings contains owner-modified content. Apply aborted before mutation.`,
    );
  }

  for (const post of launchEditorial.posts) {
    const existing = await fetchItem(request, "posts", post.id);
    const fixturePost = fixtureEditorial.posts.find((p) => p.id === post.id);
    const state = classifyRecordState(
      existing,
      fixturePost,
      post,
      POST_OWNED_FIELDS,
    );
    if (state === "owner_modified") {
      throw new Error(
        `Preflight failed: post ${post.id} (${post.slug}) contains owner-modified content. Apply aborted before mutation.`,
      );
    }
  }

  for (const topic of launchEditorial.topics) {
    const existing = await fetchItem(request, "topics", topic.id);
    const fixtureTopic = fixtureEditorial.topics.find((t) => t.id === topic.id);
    const state = classifyRecordState(
      existing,
      fixtureTopic,
      topic,
      TOPIC_OWNED_FIELDS,
    );
    if (state === "owner_modified") {
      throw new Error(
        `Preflight failed: topic ${topic.id} (${topic.slug}) contains owner-modified content. Apply aborted before mutation.`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Mutation in dependency order
  // -------------------------------------------------------------------------
  const cover = await ensureFile(
    request,
    coverFixture.title,
    IDS.folders.publishable,
    coverFixture.mimeType,
    coverFixture.bytes,
    coverFixture.filename,
  );

  const preserveAvatar = existingSettings?.avatar ?? null;
  await upsertItem(
    request,
    "site_settings",
    settingsId,
    {
      ...launchSettings,
      avatar: preserveAvatar,
      default_og_image: cover.id,
    },
    SETTINGS_OWNED_FIELDS,
  );

  for (const topic of launchEditorial.topics) {
    await upsertItem(request, "topics", topic.id, topic, TOPIC_OWNED_FIELDS);
  }

  for (const {
    date_created: _dc,
    date_updated: _du,
    id: postId,
    ...post
  } of launchEditorial.posts) {
    void _dc;
    void _du;
    await upsertItem(request, "posts", postId, post, POST_OWNED_FIELDS);
  }

  for (const relation of launchEditorial.postTopics) {
    await upsertItem(
      request,
      "posts_topics",
      relation.id,
      relation,
      POST_TOPIC_OWNED_FIELDS,
    );
  }

  for (const legacyPost of LEGACY_FIXTURE_POSTS) {
    await upsertItem(
      request,
      "posts",
      legacyPost.id,
      legacyPost,
      POST_OWNED_FIELDS,
    );
  }

  // -------------------------------------------------------------------------
  // Post-apply verification
  // -------------------------------------------------------------------------
  /** @type {Array<{ status?: string }>} */
  const verifiedPosts = await request(
    "/items/posts?limit=-1&fields=id,status,slug,published_at",
  );
  const publishedCount = verifiedPosts.filter(
    (p) => p.status === "published",
  ).length;

  console.log("=== Editorial Launch Applied Successfully ===");
  console.log(`Target Origin:   ${manifest.targetOrigin}`);
  console.log(`Manifest Digest: ${manifest.manifestDigest}`);
  console.log(`Published Posts: ${publishedCount}`);
  console.log(`Topics Count:    ${launchEditorial.topics.length}`);
  console.log(`Joins Count:     ${launchEditorial.postTopics.length}`);
  console.log("Status:          SUCCESS");
}

if (command === "plan") {
  await handlePlan();
} else if (command === "apply") {
  await handleApply();
} else {
  console.error("Usage: node directus/launch.mjs <plan|apply> [options]");
  process.exit(1);
}
