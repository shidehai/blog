// CMS origins remain host-only. Next owns Link/router redirects; native browser
// requests and server-to-server reads use this prefix explicitly.
export const CMS_BASE_PATH = "/admin";

export function cmsPath(path: "" | `/${string}` = "") {
  return `${CMS_BASE_PATH}${path}`;
}
