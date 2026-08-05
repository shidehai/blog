const arguments_ = process.argv.slice(2);
const urlIndex = arguments_.indexOf("--url");
const input = urlIndex >= 0 ? arguments_[urlIndex + 1] : arguments_[0];

if (!input) {
  throw new Error("Usage: pnpm test:headers -- --url <http-url>");
}

const baseUrl = new URL(input);
if (!["http:", "https:"].includes(baseUrl.protocol)) {
  throw new Error("Header test URL must use http or https");
}

/**
 * @param {string} path
 * @returns {Promise<Response>}
 */
async function request(path) {
  const response = await fetch(new URL(path, baseUrl), {
    redirect: "manual",
  });
  return response;
}

/**
 * @param {unknown} condition
 * @param {string} message
 * @returns {asserts condition}
 */
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * @param {Response} response
 * @param {string} name
 * @param {RegExp} expected
 */
function assertHeader(response, name, expected) {
  const value = response.headers.get(name) ?? "";
  assert(
    expected.test(value),
    `${response.url} must send ${name} matching ${expected}; received ${JSON.stringify(value)}`,
  );
}

const home = await request("/");
assert(home.ok, `Home returned ${home.status}`);
assertHeader(home, "cache-control", /max-age=0.*must-revalidate/i);
assertHeader(home, "content-security-policy", /default-src 'self'/i);
assertHeader(home, "permissions-policy", /camera=\(\)/i);
assertHeader(home, "referrer-policy", /^strict-origin-when-cross-origin$/i);
assertHeader(home, "x-content-type-options", /^nosniff$/i);
assertHeader(home, "x-frame-options", /^DENY$/i);
if (baseUrl.protocol === "https:") {
  assertHeader(home, "strict-transport-security", /max-age=31536000/i);
}

const health = await request("/healthz");
assert(health.ok, `Health route returned ${health.status}`);
assertHeader(health, "cache-control", /no-store/i);

const html = await home.text();
const assetPath = html.match(/["'](?<path>\/_astro\/[^"']+)["']/)?.groups?.path;
assert(assetPath, "Home does not reference a hashed Astro asset");
const asset = await request(assetPath);
assert(asset.ok, `Hashed asset returned ${asset.status}`);
assertHeader(asset, "cache-control", /max-age=31536000.*immutable/i);

const preview = await request("/preview/header-contract-probe");
assert(
  preview.status === 401,
  `Unauthenticated preview must be rejected by Caddy basic authentication; received ${preview.status}`,
);
assertHeader(preview, "cache-control", /private.*no-store/i);
assertHeader(preview, "x-robots-tag", /noindex.*nofollow/i);

console.log(`header contract status=success url=${baseUrl.origin}`);
