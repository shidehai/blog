import { describe, expect, it } from "vitest";

import type { RenderedMarkdown } from "../../src/lib/markdown";
import { validateGeneratedReferences } from "../../src/lib/references";

const MEDIA_ID = "15000000-0000-4000-8000-000000000001";

function output(
  values: Partial<
    Pick<RenderedMarkdown, "headings" | "links" | "mediaIds">
  > = {},
) {
  return {
    headings: values.headings ?? [],
    links: values.links ?? [],
    mediaIds: values.mediaIds ?? [],
  };
}

describe("generated reference validation", () => {
  it("accepts generated routes, same-page and cross-page anchors, and known media", () => {
    expect(() =>
      validateGeneratedReferences({
        documents: [
          {
            output: output({
              headings: [{ depth: 2, id: "概览", text: "概览" }],
              links: [
                { href: "#%E6%A6%82%E8%A7%88", line: 3 },
                { href: "/notes/second/#detail", line: 4 },
                { href: "/about/", line: 5 },
                {
                  href: "https://outside.example/unavailable#anything",
                  line: 6,
                },
              ],
            }),
            route: "/writing/first/",
          },
          {
            output: output({
              headings: [{ depth: 2, id: "detail", text: "Detail" }],
              mediaIds: [MEDIA_ID],
            }),
            route: "/notes/second/",
          },
        ],
        mediaIds: [MEDIA_ID],
        routes: ["/writing/first/", "/notes/second/", "/about/"],
      }),
    ).not.toThrow();
  });

  it("rejects a route that was not generated", () => {
    expect(() =>
      validateGeneratedReferences({
        documents: [
          {
            output: output({
              links: [{ href: "/missing/", line: 8 }],
            }),
            route: "/writing/first/",
          },
        ],
        mediaIds: [],
        routes: ["/writing/first/"],
      }),
    ).toThrow('/writing/first/ line 8: route "/missing/" was not generated');
  });

  it("rejects missing same-page and cross-page anchors", () => {
    expect(() =>
      validateGeneratedReferences({
        documents: [
          {
            output: output({
              headings: [{ depth: 2, id: "present", text: "Present" }],
              links: [
                { href: "#absent", line: 2 },
                { href: "/notes/second/#absent", line: 3 },
              ],
            }),
            route: "/writing/first/",
          },
          {
            output: output(),
            route: "/notes/second/",
          },
        ],
        mediaIds: [],
        routes: ["/writing/first/", "/notes/second/"],
      }),
    ).toThrow("anchor");
  });

  it("rejects a CMS media reference absent from the snapshot", () => {
    expect(() =>
      validateGeneratedReferences({
        documents: [
          {
            output: output({ mediaIds: [MEDIA_ID] }),
            route: "/writing/first/",
          },
        ],
        mediaIds: [],
        routes: ["/writing/first/"],
      }),
    ).toThrow(`referenced CMS media ${MEDIA_ID} is missing`);
  });

  it("rejects non-root generated routes but never probes external links", () => {
    expect(() =>
      validateGeneratedReferences({
        documents: [],
        mediaIds: [],
        routes: ["relative/path"],
      }),
    ).toThrow('generated route "relative/path" must be root-relative');
  });
});
