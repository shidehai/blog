import process from "node:process";

/**
 * @typedef {object} ComposePort
 * @property {number | string} [published]
 * @property {number | string} [target]
 * @property {string} [host_ip]
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
 * @property {{target: string, read_only?: boolean}[]} [volumes]
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
const local = process.argv.includes("--local");

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
const cms = requireService("cms");
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
if (local) {
  assert(
    (caddy.profiles ?? []).includes("production"),
    "local Caddy must remain opt-in",
  );
}
const localPorts = new Map([
  ["site", [4321, 4321]],
  ["cms", [4322, 4322]],
  ["postgres", [55433, 5432]],
]);
for (const [name, service] of Object.entries(services)) {
  const expected = local ? localPorts.get(name) : undefined;
  if (expected) {
    const ports = service.ports ?? [];
    assert(
      ports.length === 1 &&
        ports[0]?.host_ip === "127.0.0.1" &&
        Number(ports[0]?.published) === expected[0] &&
        Number(ports[0]?.target) === expected[1],
      `${name} local port must bind only the intended loopback address`,
    );
    continue;
  }
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
const imagePattern = local
  ? /^(?:ghcr\.io\/[a-z0-9./_-]+@)?sha256:[0-9a-f]{64}$/
  : /^ghcr\.io\/[a-z0-9./_-]+@sha256:[0-9a-f]{64}$/;
assert(imagePattern.test(site.image ?? ""), "site image must be immutable");
const siteEnvironment = site.environment ?? {};
assert(
  siteEnvironment.SITE_URL ===
    (local
      ? "http://localhost:4321"
      : `https://${caddy.environment?.SITE_DOMAIN}`),
  "site metadata must use the configured public origin",
);
assert(
  siteEnvironment.CONTENT_SOURCE === "cms",
  "production reads only the author CMS",
);
assert(
  siteEnvironment.CMS_INTERNAL_URL === "http://cms:4322",
  "site reads the internal CMS",
);
assert(
  (siteEnvironment.CMS_READ_TOKEN ?? "").length >= 32,
  "site requires runtime reader token",
);
for (const name of [
  "DATABASE_URL",
  "CMS_DATABASE_URL",
  "DIRECTUS_BUILD_TOKEN",
  "DIRECTUS_PREVIEW_TOKEN",
])
  assert(
    !Object.hasOwn(siteEnvironment, name),
    `site must not receive ${name}`,
  );
assert(
  cms.read_only === true && (cms.cap_drop ?? []).includes("ALL"),
  "CMS runtime is read-only and drops capabilities",
);
assert(
  imagePattern.test(cms.image ?? ""),
  "CMS image must be an immutable digest",
);
assert(
  cms.environment?.CMS_READ_TOKEN === siteEnvironment.CMS_READ_TOKEN,
  "reader tokens must match",
);
assert(
  Object.hasOwn(cms.environment ?? {}, "DATABASE_URL"),
  "CMS owns database connection",
);
assert(!services.directus, "normal operation does not run Directus");
assert(
  postgres.image === "postgres:17.9-alpine",
  "PostgreSQL image must remain pinned to 17.9-alpine",
);
assert(
  caddy.image === "caddy:2.10.2-alpine",
  "Caddy image must remain pinned to 2.10.2-alpine",
);

assert(
  Object.keys(postgres.networks ?? {}).length === (local ? 2 : 1) &&
    Object.hasOwn(postgres.networks ?? {}, "data") &&
    (!local || Object.hasOwn(postgres.networks ?? {}, "web")),
  "PostgreSQL networks must match the selected local or production topology",
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
for (const [service, mediaTarget, readOnly] of [
  [backup, "/data/cms-media", true],
  [restore, "/restore/cms-media", false],
]) {
  const mounts = service.volumes ?? [];
  assert(
    mounts.length === 2 &&
      mounts.some((mount) => mount.target === "/backup-staging") &&
      mounts.some(
        (mount) =>
          mount.target === mediaTarget && Boolean(mount.read_only) === readOnly,
      ),
    "backup and restore require only CMS media and temporary staging mounts",
  );
}

console.log(
  `compose contract mode=${local ? "local" : "production"} status=success`,
);
