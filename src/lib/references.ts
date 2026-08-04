import type { RenderedMarkdown } from "./markdown";

const INTERNAL_ORIGIN = "https://generated.invalid";

type MarkdownReferences = Pick<
  RenderedMarkdown,
  "headings" | "links" | "mediaIds"
>;

export interface GeneratedDocument {
  output: MarkdownReferences;
  route: string;
}

export interface GeneratedReferenceManifest {
  documents: readonly GeneratedDocument[];
  mediaIds: Iterable<string>;
  routes: Iterable<string>;
}

function isRootRoute(route: string): boolean {
  if (!route.startsWith("/") || route.startsWith("//")) return false;
  const url = new URL(route, INTERNAL_ORIGIN);
  return !url.search && !url.hash && url.pathname === route;
}

function source(route: string, line: number | null): string {
  return line === null ? route : `${route} line ${line}`;
}

function decodeFragment(fragment: string): string | null {
  if (!fragment) return null;
  try {
    return decodeURIComponent(fragment);
  } catch {
    return null;
  }
}

export function validateGeneratedReferences(
  manifest: GeneratedReferenceManifest,
): void {
  const errors: string[] = [];
  const routes = new Set<string>();
  for (const route of manifest.routes) {
    if (!isRootRoute(route)) {
      errors.push(`generated route "${route}" must be root-relative`);
      continue;
    }
    if (routes.has(route))
      errors.push(`generated route "${route}" is duplicated`);
    routes.add(route);
  }

  const availableMedia = new Set(manifest.mediaIds);
  const headingsByRoute = new Map<string, Set<string>>();
  for (const document of manifest.documents) {
    if (!isRootRoute(document.route)) {
      errors.push(`document route "${document.route}" must be root-relative`);
      continue;
    }
    if (!routes.has(document.route)) {
      errors.push(`document route "${document.route}" was not generated`);
    }
    if (headingsByRoute.has(document.route)) {
      errors.push(`document route "${document.route}" is duplicated`);
      continue;
    }
    const headings = new Set<string>();
    for (const heading of document.output.headings) {
      if (headings.has(heading.id)) {
        errors.push(
          `${document.route}: heading "#${heading.id}" is duplicated`,
        );
      }
      headings.add(heading.id);
    }
    headingsByRoute.set(document.route, headings);
  }

  for (const document of manifest.documents) {
    if (!isRootRoute(document.route)) continue;

    for (const id of document.output.mediaIds) {
      if (!availableMedia.has(id)) {
        errors.push(`${document.route}: referenced CMS media ${id} is missing`);
      }
    }

    for (const link of document.output.links) {
      if (!link.href.startsWith("/") && !link.href.startsWith("#")) continue;
      if (link.href.startsWith("//")) {
        errors.push(
          `${source(document.route, link.line)}: "${link.href}" is not a root-relative route`,
        );
        continue;
      }

      const target = new URL(link.href, `${INTERNAL_ORIGIN}${document.route}`);
      const targetRoute = link.href.startsWith("#")
        ? document.route
        : target.pathname;
      if (!routes.has(targetRoute)) {
        errors.push(
          `${source(document.route, link.line)}: route "${targetRoute}" was not generated`,
        );
        continue;
      }

      if (!target.hash) continue;
      const fragment = decodeFragment(target.hash.slice(1));
      if (fragment === null) {
        errors.push(
          `${source(document.route, link.line)}: fragment in "${link.href}" is invalid`,
        );
        continue;
      }
      const targetHeadings = headingsByRoute.get(targetRoute);
      if (!targetHeadings?.has(fragment)) {
        errors.push(
          `${source(document.route, link.line)}: anchor "${targetRoute}#${fragment}" was not generated`,
        );
      }
    }
  }

  if (errors.length) {
    throw new Error(`Invalid generated references:\n${errors.join("\n")}`);
  }
}
