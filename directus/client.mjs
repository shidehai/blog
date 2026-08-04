const baseUrl = (process.env.DIRECTUS_URL || "http://127.0.0.1:8055").replace(
  /\/$/,
  "",
);

/** @typedef {Omit<RequestInit, "body"> & { body?: FormData | Record<string, unknown> | null }} DirectusRequestOptions */
/** @typedef {Error & { status: number }} DirectusError */

/**
 * @param {string} [token]
 */
export function directusClient(token) {
  /**
   * @template T
   * @param {string} path
   * @param {DirectusRequestOptions} [options]
   * @returns {Promise<T>}
   */
  return async function request(path, options = {}) {
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const { body: inputBody, ...init } = options;
    /** @type {FormData | Record<string, unknown> | string | null | undefined} */
    let body = inputBody;
    if (body !== undefined && !(body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      ...(body === undefined ? {} : { body }),
    });
    /** @type {{ data?: T, errors?: Array<{ message?: string }> } | null} */
    const payload =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const reason = payload?.errors?.[0]?.message || response.statusText;
      throw Object.assign(
        new Error(
          `${options.method || "GET"} ${path}: ${response.status} ${reason}`,
        ),
        {
          status: response.status,
        },
      );
    }

    return /** @type {T} */ (payload?.data ?? payload);
  };
}

/**
 * @param {unknown} error
 * @returns {error is DirectusError}
 */
export function isDirectusError(error) {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number"
  );
}

export async function adminClient() {
  if (process.env.DIRECTUS_ADMIN_TOKEN) {
    return directusClient(process.env.DIRECTUS_ADMIN_TOKEN);
  }

  const email = process.env.DIRECTUS_ADMIN_EMAIL;
  const password = process.env.DIRECTUS_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set DIRECTUS_ADMIN_TOKEN or DIRECTUS_ADMIN_EMAIL and DIRECTUS_ADMIN_PASSWORD",
    );
  }

  /** @type {{ access_token: string }} */
  const login = await directusClient()("/auth/login", {
    method: "POST",
    body: { email, password, mode: "json" },
  });
  return directusClient(login.access_token);
}

/**
 * @param {string} endpoint
 * @param {string} field
 * @param {string} value
 * @param {string} [fields]
 */
export function filterPath(endpoint, field, value, fields = "*") {
  const query = new URLSearchParams({ limit: "-1", fields });
  query.set(`filter[${field}][_eq]`, value);
  return `/${endpoint}?${query}`;
}
