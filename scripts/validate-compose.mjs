import process from "node:process";

/**
 * @typedef {object} ComposePort
 * @property {number | string} [published]
 */

/**
 * @typedef {object} ComposeService
 * @property {string} [image]
 * @property {boolean} [read_only]
 * @property {string[]} [cap_drop]
 * @property {Record<string, string>} [environment]
 * @property {ComposePort[]} [ports]
 * @property {Record<string, unknown>} [networks]
 * @property {string[]} [profiles]
 */

/**
 * @typedef {object} ComposeConfig
 * @property {Record<string, ComposeService>} [services]
 * @property {Record<string, { internal?: boolean }>} [networks]
 */

let input = "";
for await (const chunk of process.stdin) input += chunk;
const config = /** @type {ComposeConfig} */ (JSON.parse(input));
const services = config.services ?? {};

/**
 * @param {unknown} condition
 * @param {string} message
 * @returns {asserts condition}
 */
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * @param {string} name
 * @returns {ComposeService}
 */
function requireService(name) {
  const service = services[name];
  if (!service) throw new Error(`Compose service is missing: ${name}`);
  return service;
}

const caddy = requireService("caddy");
const site = requireService("site");
const directus = requireService("directus");
const postgres = requireService("postgres");
const backup = requireService("backup");
const restore = requireService("restore");
const resticMaintenance = requireService("restic-maintenance");

const caddyPorts = caddy.ports ?? [];
const published = caddyPorts
  .map((/** @type {ComposePort} */ port) => Number(port.published))
  .sort((left, right) => left - right);
assert(
  published.length === 3 &&
    published[0] === 80 &&
    published[1] === 443 &&
    published[2] === 443,
  "Caddy must be the only service publishing 80/443 TCP and 443 UDP",
);
for (const [name, service] of Object.entries(services)) {
  if (name !== "caddy") {
    assert(
      (service.ports ?? []).length === 0,
      `${name} must not publish a port`,
    );
  }
}

assert(site.read_only === true, "site must use a read-only root");
assert(
  (site.cap_drop ?? []).includes("ALL"),
  "site must drop all capabilities",
);
assert(
  /^ghcr\.io\/[a-z0-9./_-]+@sha256:[0-9a-f]{64}$/.test(site.image ?? ""),
  "site image must be an immutable GHCR digest",
);
assert(
  site.environment?.CONTENT_SOURCE === "directus",
  "production site runtime must use the Directus preview source",
);
assert(
  directus.image === "directus/directus:12.2.0",
  "Directus image must remain pinned to 12.2.0",
);
assert(
  postgres.image === "postgres:17.9-alpine",
  "PostgreSQL image must remain pinned to 17.9-alpine",
);
assert(
  caddy.image === "caddy:2.10.2-alpine",
  "Caddy image must remain pinned to 2.10.2-alpine",
);

assert(
  Object.keys(postgres.networks ?? {}).length === 1 &&
    Object.hasOwn(postgres.networks ?? {}, "data"),
  "PostgreSQL must join only the data network",
);
assert(
  config.networks?.data?.internal === true,
  "data network must be internal",
);
assert((backup.profiles ?? []).includes("backup"), "backup must remain opt-in");
assert(
  (restore.profiles ?? []).includes("restore"),
  "restore must remain opt-in",
);
assert(
  (resticMaintenance.profiles ?? []).includes("maintenance"),
  "Restic maintenance must remain opt-in",
);

console.log("compose contract status=success");
