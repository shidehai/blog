import { createHmac } from "node:crypto";
import {
  adminClient,
  directusClient,
  filterPath,
  isDirectusError,
} from "./client.mjs";
import { IDS } from "./constants.mjs";

const request = await adminClient();

/**
 * @typedef {Record<string, unknown> & { id: string, name?: string }} DirectusItem
 * @typedef {Record<string, unknown> & { name?: string }} DirectusInput
 * @typedef {DirectusItem & { email?: string, tfa_secret?: string | null }} DirectusUser
 * @typedef {{ override?: boolean | null, default: boolean }} Entitlement
 * @typedef {{ collection: string, action: string, fields: string[], permissions: Record<string, unknown>, validation: Record<string, unknown> | null, presets: Record<string, unknown> | null }} Permission
 * @typedef {Permission & { id: string }} StoredPermission
 */

/**
 * @template {DirectusItem} [T=DirectusItem]
 * @param {string} endpoint
 * @param {string} id
 * @param {DirectusInput} data
 * @param {[string, string | undefined]} [identity]
 * @returns {Promise<T>}
 */
async function upsert(endpoint, id, data, identity = ["name", data.name]) {
  /** @type {T | undefined} */
  let existing;
  try {
    existing = await request(`/${endpoint}/${id}`);
  } catch (error) {
    if (
      !isDirectusError(error) ||
      (error.status !== 404 && error.status !== 403)
    )
      throw error;
  }

  if (!existing && identity[1]) {
    /** @type {T[]} */
    const matches = await request(
      filterPath(endpoint, identity[0], identity[1], "*"),
    );
    [existing] = matches;
  }

  if (existing) {
    return request(`/${endpoint}/${existing.id}`, {
      method: "PATCH",
      body: data,
    });
  }
  return request(`/${endpoint}`, { method: "POST", body: { id, ...data } });
}

const folders = await Promise.all([
  upsert("folders", IDS.folders.publishable, {
    name: "publishable-assets",
    parent: null,
  }),
  upsert("folders", IDS.folders.private, {
    name: "private-draft-assets",
    parent: null,
  }),
]);

const policyDefinitions = {
  author: {
    name: "Author",
    icon: "edit_note",
    description:
      "Daily MFA-protected authoring without platform administration.",
    enforce_tfa: true,
    admin_access: false,
    app_access: true,
  },
  build: {
    name: "Build Reader",
    icon: "build",
    description: "Server-only published snapshot reader.",
    enforce_tfa: false,
    admin_access: false,
    app_access: false,
  },
  preview: {
    name: "Preview Reader",
    icon: "preview",
    description: "Server-only draft and published preview reader.",
    enforce_tfa: false,
    admin_access: false,
    app_access: false,
  },
  administrator: {
    name: "Break-glass Administrator",
    icon: "admin_panel_settings",
    description: "MFA-protected schema and account recovery access only.",
    enforce_tfa: true,
    admin_access: true,
    app_access: true,
  },
};

/** @typedef {keyof typeof policyDefinitions} PolicyKey */
/** @type {Record<PolicyKey, [string, string, string]>} */
const roleDefinitions = {
  author: ["Author", "edit_note", "Routine content authoring role."],
  build: ["Build Reader", "build", "Static build service role."],
  preview: ["Preview Reader", "preview", "Protected preview service role."],
  administrator: [
    "Break-glass Administrator",
    "admin_panel_settings",
    "Emergency administration role.",
  ],
};

const policies = /** @type {Record<PolicyKey, DirectusItem>} */ ({});
const roles = /** @type {Record<PolicyKey, DirectusItem>} */ ({});
for (const key of /** @type {PolicyKey[]} */ (Object.keys(policyDefinitions))) {
  policies[key] = await upsert(
    "policies",
    IDS.policies[key],
    policyDefinitions[key],
  );
  const [name, icon, description] = roleDefinitions[key];
  roles[key] = await upsert("roles", IDS.roles[key], {
    name,
    icon,
    description,
  });

  /** @type {Array<{ id: string, role: string | { id: string } | null, policy: string | { id: string } | null }>} */
  const access = await request("/access?limit=-1&fields=*");
  const match = access.find((entry) => {
    const role = typeof entry.role === "string" ? entry.role : entry.role?.id;
    const policy =
      typeof entry.policy === "string" ? entry.policy : entry.policy?.id;
    return role === roles[key].id && policy === policies[key].id;
  });
  const data = {
    role: roles[key].id,
    policy: policies[key].id,
    user: null,
    sort: 1,
  };
  if (match)
    await request(`/access/${match.id}`, { method: "PATCH", body: data });
  else
    await request("/access", {
      method: "POST",
      body: { id: IDS.access[key], ...data },
    });
}

/** @type {{ entitlements: { custom_permission_rules_enabled: Entitlement } }} */
const license = await request("/license");
const customRules = license.entitlements.custom_permission_rules_enabled;
if (!(customRules.override ?? customRules.default)) {
  throw new Error(
    "Directus custom permission rules are unavailable on Core. Activate an eligible Open Innovation Grant or paid license, then rerun this bootstrap.",
  );
}

const projectFields = {
  posts: [
    "id",
    "status",
    "kind",
    "title",
    "slug",
    "published_at",
    "summary",
    "body",
    "topics",
    "featured",
    "cover_image",
    "cover_alt",
    "cover_decorative",
    "seo_title",
    "seo_description",
    "user_created",
    "date_created",
    "user_updated",
    "date_updated",
  ],
  topics: [
    "id",
    "name",
    "slug",
    "description",
    "posts",
    "user_created",
    "date_created",
    "user_updated",
    "date_updated",
  ],
  posts_topics: ["id", "posts_id", "topics_id"],
  site_settings: [
    "id",
    "site_name",
    "author_name",
    "tagline",
    "homepage_intro",
    "biography",
    "default_seo_description",
    "avatar",
    "default_og_image",
    "social_links",
    "footer_text",
    "locale",
    "timezone",
    "user_created",
    "date_created",
    "user_updated",
    "date_updated",
  ],
  social_links: [
    "id",
    "site_settings_id",
    "label",
    "url",
    "icon",
    "sort",
    "user_created",
    "date_created",
    "user_updated",
    "date_updated",
  ],
};
const publicFileFields = [
  "id",
  "storage",
  "filename_disk",
  "filename_download",
  "title",
  "type",
  "folder",
  "filesize",
  "width",
  "height",
  "duration",
  "description",
  "metadata",
  "focal_point_x",
  "focal_point_y",
  "modified_on",
];
const all = ["*"];
/**
 * @param {string} collection
 * @param {string} action
 * @param {string[]} [fields]
 * @param {Record<string, unknown>} [permissions]
 * @param {Record<string, unknown> | null} [validation]
 * @param {Record<string, unknown> | null} [presets]
 * @returns {Permission}
 */
const allow = (
  collection,
  action,
  fields = all,
  permissions = {},
  validation = null,
  presets = null,
) => ({ collection, action, fields, permissions, validation, presets });

/** @type {Permission[]} */
const authorPermissions = [];
for (const [collection, fields] of Object.entries(projectFields)) {
  authorPermissions.push(
    allow(collection, "create", fields, {}, {}, null),
    allow(collection, "read", fields),
    allow(collection, "update", fields, {}, {}, null),
    allow(collection, "delete", all),
  );
}
authorPermissions.push(
  allow("directus_folders", "read", ["id", "name", "parent"], {
    id: { _in: folders.map((folder) => folder.id) },
  }),
  allow(
    "directus_files",
    "create",
    all,
    {},
    { folder: { _in: folders.map((folder) => folder.id) } },
    { folder: IDS.folders.private },
  ),
  allow("directus_files", "read", all, {
    folder: { _in: folders.map((folder) => folder.id) },
  }),
  allow(
    "directus_files",
    "update",
    [
      "title",
      "description",
      "tags",
      "folder",
      "focal_point_x",
      "focal_point_y",
    ],
    { folder: { _in: folders.map((folder) => folder.id) } },
    { folder: { _in: folders.map((folder) => folder.id) } },
  ),
  allow(
    "directus_versions",
    "create",
    all,
    {},
    { collection: { _in: ["posts", "site_settings"] } },
  ),
  allow("directus_versions", "read", all, {
    collection: { _in: ["posts", "site_settings"] },
  }),
  allow(
    "directus_versions",
    "update",
    all,
    { collection: { _in: ["posts", "site_settings"] } },
    { collection: { _in: ["posts", "site_settings"] } },
  ),
  allow("directus_versions", "delete", all, {
    collection: { _in: ["posts", "site_settings"] },
  }),
  allow("directus_revisions", "read", all, {
    collection: { _in: ["posts", "site_settings"] },
  }),
);

/** @type {Permission[]} */
const buildPermissions = [
  allow("posts", "read", projectFields.posts, { status: { _eq: "published" } }),
  allow("topics", "read", projectFields.topics),
  allow("posts_topics", "read", projectFields.posts_topics, {
    posts_id: { status: { _eq: "published" } },
  }),
  allow("site_settings", "read", projectFields.site_settings),
  allow("social_links", "read", projectFields.social_links),
  allow("directus_files", "read", publicFileFields, {
    folder: { _eq: IDS.folders.publishable },
  }),
  allow("directus_folders", "read", ["id", "name"], {
    id: { _eq: IDS.folders.publishable },
  }),
];

/** @type {Permission[]} */
const previewPermissions = [
  ...Object.entries(projectFields).map(([collection, fields]) =>
    allow(collection, "read", fields),
  ),
  allow("directus_files", "read", publicFileFields, {
    folder: { _in: folders.map((folder) => folder.id) },
  }),
  allow("directus_folders", "read", ["id", "name"], {
    id: { _in: folders.map((folder) => folder.id) },
  }),
  allow("directus_versions", "read", all, {
    collection: { _in: ["posts", "site_settings"] },
  }),
  allow("directus_revisions", "read", all, {
    collection: { _in: ["posts", "site_settings"] },
  }),
];

/**
 * @param {DirectusItem} policy
 * @param {Permission[]} wanted
 */
async function reconcilePermissions(policy, wanted) {
  /** @type {StoredPermission[]} */
  const existing = await request(
    filterPath(
      "permissions",
      "policy",
      policy.id,
      "id,policy,collection,action,permissions,validation,presets,fields",
    ),
  );
  const desired = new Map(
    wanted.map((entry) => [`${entry.collection}:${entry.action}`, entry]),
  );

  for (const permission of existing) {
    const key = `${permission.collection}:${permission.action}`;
    if (!desired.has(key))
      await request(`/permissions/${permission.id}`, { method: "DELETE" });
  }

  for (const [key, data] of desired) {
    const matches = existing.filter(
      (entry) => `${entry.collection}:${entry.action}` === key,
    );
    const payload = { policy: policy.id, ...data };
    if (matches[0])
      await request(`/permissions/${matches[0].id}`, {
        method: "PATCH",
        body: payload,
      });
    else await request("/permissions", { method: "POST", body: payload });
    for (const duplicate of matches.slice(1))
      await request(`/permissions/${duplicate.id}`, { method: "DELETE" });
  }
}

await reconcilePermissions(policies.author, authorPermissions);
await reconcilePermissions(policies.build, buildPermissions);
await reconcilePermissions(policies.preview, previewPermissions);

/** @type {DirectusItem[]} */
const publicPolicies = await request(
  filterPath("policies", "name", "$t:public_label", "id,name"),
);
if (publicPolicies[0]) await reconcilePermissions(publicPolicies[0], []);

/**
 * @param {string | null | undefined} value
 */
function usableSecret(value) {
  return Boolean(value && !value.startsWith("replace-") && value.length >= 24);
}

/**
 * @param {string} id
 * @param {DirectusItem} role
 * @param {string | undefined} email
 * @param {string | null | undefined} token
 * @param {string | undefined} [password]
 * @returns {Promise<DirectusUser | null>}
 */
async function upsertUser(id, role, email, token, password) {
  if (!email || (!token && !password)) return null;
  const data = {
    email,
    role: role.id,
    status: "active",
    ...(token ? { token } : {}),
    ...(password ? { password } : {}),
  };
  return upsert("users", id, data, ["email", email]);
}

await upsertUser(
  IDS.users.build,
  roles.build,
  "build-reader@service.invalid",
  usableSecret(process.env.DIRECTUS_BUILD_TOKEN)
    ? process.env.DIRECTUS_BUILD_TOKEN
    : null,
);
await upsertUser(
  IDS.users.preview,
  roles.preview,
  "preview-reader@service.invalid",
  usableSecret(process.env.DIRECTUS_PREVIEW_TOKEN)
    ? process.env.DIRECTUS_PREVIEW_TOKEN
    : null,
);
const author = await upsertUser(
  IDS.users.author,
  roles.author,
  process.env.DIRECTUS_AUTHOR_EMAIL,
  usableSecret(process.env.DIRECTUS_TEST_AUTHOR_TOKEN)
    ? process.env.DIRECTUS_TEST_AUTHOR_TOKEN
    : null,
  process.env.DIRECTUS_AUTHOR_PASSWORD,
);
const administrator = await upsertUser(
  IDS.users.administrator,
  roles.administrator,
  process.env.DIRECTUS_BREAK_GLASS_EMAIL,
  usableSecret(process.env.DIRECTUS_TEST_BREAK_GLASS_TOKEN)
    ? process.env.DIRECTUS_TEST_BREAK_GLASS_TOKEN
    : null,
  process.env.DIRECTUS_BREAK_GLASS_PASSWORD,
);

/**
 * @param {string} value
 */
function base32Bytes(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.replace(/=+$/, "").toUpperCase())
    bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  return Buffer.from(
    bits.match(/.{8}/g)?.map((byte) => Number.parseInt(byte, 2)) || [],
  );
}

/**
 * @param {string} secret
 */
function otp(secret) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", base32Bytes(secret))
    .update(counter)
    .digest();
  const offset = digest.readUInt8(digest.length - 1) & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000)
    .toString()
    .padStart(6, "0");
}

/**
 * @param {DirectusUser | null} user
 * @param {string | undefined} password
 */
async function enrollTestTfa(user, password) {
  if (
    !user ||
    user.tfa_secret ||
    process.env.DIRECTUS_ENROLL_TEST_TFA !== "true"
  )
    return;
  /** @type {{ access_token: string }} */
  const login = await directusClient()("/auth/login", {
    method: "POST",
    body: { email: user.email, password, mode: "json" },
  });
  const userRequest = directusClient(login.access_token);
  /** @type {{ secret: string }} */
  const generated = await userRequest("/users/me/tfa/generate", {
    method: "POST",
    body: { password },
  });
  await userRequest("/users/me/tfa/enable", {
    method: "POST",
    body: { secret: generated.secret, otp: otp(generated.secret) },
  });
}

await enrollTestTfa(author, process.env.DIRECTUS_AUTHOR_PASSWORD);
await enrollTestTfa(administrator, process.env.DIRECTUS_BREAK_GLASS_PASSWORD);

const flowEnabled =
  process.env.DIRECTUS_ENABLE_BUILD_FLOW === "true" &&
  usableSecret(process.env.GITHUB_DISPATCH_TOKEN) &&
  Boolean(process.env.GITHUB_REPOSITORY);
if (flowEnabled && !author) {
  throw new Error(
    "DIRECTUS_AUTHOR_EMAIL and an Author credential are required before enabling the build Flow.",
  );
}
const flow = await upsert("flows", IDS.flow, {
  name: "Dispatch public site build",
  icon: "rocket_launch",
  description:
    "Dispatches a static build for published-row and publishable-asset changes.",
  status: flowEnabled ? "active" : "inactive",
  accountability: "all",
  trigger: "event",
  options: {
    type: "action",
    scope: ["items.create", "items.update", "items.delete"],
    collections: [
      "posts",
      "topics",
      "posts_topics",
      "site_settings",
      "social_links",
      "directus_files",
    ],
  },
});
const dispatchFailure = await upsert(
  "operations",
  IDS.dispatchFailure,
  {
    flow: flow.id,
    key: "dispatch_failure_notification",
    type: "notification",
    name: "Notify build dispatch failure",
    position_x: 55,
    position_y: 13,
    options: {
      recipient: author?.id ?? IDS.users.author,
      subject: "Public site build dispatch failed",
      message:
        "GitHub build dispatch failed for {{$trigger.collection}} {{$trigger.event}}. Inspect the Flow log, then run the main-branch workflow manually.",
      permissions: "$full",
    },
    resolve: null,
    reject: null,
  },
  ["key", "dispatch_failure_notification"],
);
const dispatch = await upsert(
  "operations",
  IDS.dispatch,
  {
    flow: flow.id,
    key: "dispatch_build",
    type: "request",
    name: "Dispatch GitHub build",
    position_x: 37,
    position_y: 1,
    options: {
      method: "POST",
      url: "https://api.github.com/repos/{{$env.GITHUB_REPOSITORY}}/dispatches",
      headers: [
        { header: "Accept", value: "application/vnd.github+json" },
        { header: "Content-Type", value: "application/json" },
        {
          header: "Authorization",
          value: "Bearer {{$env.GITHUB_DISPATCH_TOKEN}}",
        },
        { header: "X-GitHub-Api-Version", value: "2022-11-28" },
      ],
      body: '{"event_type":"directus-publish","client_payload":{"collection":"{{ $trigger.collection }}","event":"{{ $trigger.event }}"}}',
    },
    resolve: null,
    reject: dispatchFailure.id,
  },
  ["key", "dispatch_build"],
);
const condition = await upsert(
  "operations",
  IDS.condition,
  {
    flow: flow.id,
    key: "public_change",
    type: "condition",
    name: "Published row or publishable asset",
    position_x: 19,
    position_y: 1,
    options: {
      filter: {
        _or: [
          { $trigger: { collection: { _neq: "directus_files" } } },
          {
            $trigger: { payload: { folder: { _eq: IDS.folders.publishable } } },
          },
        ],
      },
    },
    resolve: dispatch.id,
    reject: null,
  },
  ["key", "public_change"],
);
await request(`/flows/${flow.id}`, {
  method: "PATCH",
  body: { operation: condition.id },
});

console.log(
  `Directus bootstrap complete (${flowEnabled ? "build flow active" : "build flow inactive"})`,
);
