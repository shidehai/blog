import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownContent } from "../components/MarkdownContent";
import { extractHeadings } from "./markdown";
import {
  type MarkdownImage,
  findUnsupportedMarkdownImageSources,
  mapMarkdownImages,
  withMarkdownImageSource,
} from "./markdown-images";

function collect(markdown: string): MarkdownImage[] {
  const images: MarkdownImage[] = [];
  assert.equal(
    mapMarkdownImages(markdown, (image) => {
      images.push(image);
      return image.raw;
    }),
    markdown,
    "Identity mapping must preserve the exact original Markdown",
  );
  return images;
}

function render(content: string): string {
  return renderToStaticMarkup(createElement(MarkdownContent, { content }));
}

const fileId = "11111111-1111-4111-8111-111111111111";
const examples = [
  [
    `![封面](directus://${fileId} "**标题** _原样_")`,
    `directus://${fileId}`,
    "封面",
    "**标题** _原样_",
  ],
  [
    "![外链](https://images.example.test/a(b).png '单引号标题')",
    "https://images.example.test/a(b).png",
    "外链",
    "单引号标题",
  ],
  [
    String.raw`![escaped \] bracket](/local/a\(b\).png "quote: \"title\"")`,
    "/local/a(b).png",
    "escaped ] bracket",
    'quote: "title"',
  ],
  [
    "![nested [label]](</local/image with spaces.png>)",
    "/local/image with spaces.png",
    "nested [label]",
    undefined,
  ],
  ["![plain](/avatar.svg)", "/avatar.svg", "plain", undefined],
] as const;
for (const [markdown, source, alt, title] of examples) {
  const [image] = collect(markdown);
  assert.ok(image, markdown);
  assert.equal(image.source, source);
  assert.equal(image.alt, alt);
  assert.equal(image.title, title);
  const rewritten = withMarkdownImageSource(image, "/_cms/digest.webp");
  assert.equal(
    rewritten,
    image.raw.slice(0, image.sourceStart) +
      "/_cms/digest.webp" +
      image.raw.slice(image.sourceEnd),
  );
  const [rewrittenImage] = collect(rewritten);
  assert.ok(rewrittenImage);
  assert.equal(rewrittenImage.source, "/_cms/digest.webp");
  assert.equal(rewrittenImage.alt, alt);
  assert.equal(rewrittenImage.title, title);
}

const literal = `![example](directus://${fileId} "title")`;
const protectedExamples = [
  `\`${literal}\``,
  `\`\`text \` ${literal} \` text\`\``,
  `\`\`\`md\n${literal}\n\`\`\``,
  `~~~~md\r\n${literal}\r\n~~~\r\n${literal}\r\n~~~~`,
  `> \`\`\`md\n> ${literal}\n> \`\`\``,
  `\`\`\`md\n${literal}`,
  String.raw`\![escaped](directus://${fileId})`,
];
for (const example of protectedExamples) {
  assert.deepEqual(collect(example), [], example);
  assert.equal(
    mapMarkdownImages(example, () => {
      throw new Error("Code/escaped syntax must not be visited");
    }),
    example,
  );
}
assert.deepEqual(
  collect(`${protectedExamples[0]}\n\n${literal}\n![second](/avatar.svg)`).map(
    (image) => image.source,
  ),
  [`directus://${fileId}`, "/avatar.svg"],
);
assert.equal(
  collect(String.raw`\\![visible](/avatar.svg)`).length,
  1,
  "Even backslashes leave image syntax active",
);
assert.equal(
  collect(`unmatched \` then ${literal}`).length,
  1,
  "An unmatched code delimiter does not hide following images",
);
assert.equal(
  mapMarkdownImages(`before ${literal} after`, (image) =>
    withMarkdownImageSource(image, "/_cms/test.webp"),
  ),
  'before ![example](/_cms/test.webp "title") after',
);

const htmlSources = `<img src="directus://${fileId}" alt="x > y">\n<IMG SRC='/assets/${fileId}'>\n<source srcset="/assets/${fileId} 1x, https://cms.example.test/assets/${fileId} 2x">`;
assert.deepEqual(findUnsupportedMarkdownImageSources(htmlSources), [
  `directus://${fileId}`,
  `/assets/${fileId}`,
  `/assets/${fileId}`,
  `https://cms.example.test/assets/${fileId}`,
]);
assert.deepEqual(
  findUnsupportedMarkdownImageSources(
    `<img src="directus&colon;&#47;&#x2f;${fileId}">\n<img src='directus&#58//${fileId}'>`,
  ),
  [`directus://${fileId}`, `directus://${fileId}`],
);
assert.deepEqual(
  findUnsupportedMarkdownImageSources(`<img src="&#47assets&#47;${fileId}">`),
  [`/assets/${fileId}`],
);
const references = `![first][Cover]\n![collapsed][]\n![shortcut]\n\n[cover]: <directus://${fileId}> "title"\n[collapsed]: /assets/${fileId}\n[shortcut]: https://cms.example.test/assets/${fileId}`;
assert.deepEqual(
  findUnsupportedMarkdownImageSources(
    `![cover]\n[cover]:\n  <directus://${fileId}>`,
  ),
  [`directus://${fileId}`],
);
assert.deepEqual(findUnsupportedMarkdownImageSources(references), [
  `directus://${fileId}`,
  `/assets/${fileId}`,
  `https://cms.example.test/assets/${fileId}`,
]);
assert.deepEqual(
  findUnsupportedMarkdownImageSources(
    `\`\`\`html\n${htmlSources}\n${references}\n\`\`\`\n\`<img src="directus://${fileId}">\`\n\\<img src="directus://${fileId}">\n\\![escaped][ref]\n[ref]: directus://${fileId}`,
  ),
  [],
);
assert.deepEqual(
  findUnsupportedMarkdownImageSources(
    `Unused definition only.\n[cover]: directus://${fileId}`,
  ),
  [],
  "Unreferenced definitions are not image requests",
);
assert.deepEqual(
  findUnsupportedMarkdownImageSources(
    `<img data-src="directus://${fileId}" alt="src='/assets/${fileId}'">`,
  ),
  [],
  "Only actual src/srcset attributes are image destinations",
);
assert.deepEqual(
  findUnsupportedMarkdownImageSources(
    `![cover]\n[cover]: directus://${fileId}\n[cover]: /ordinary.png`,
  ),
  [`directus://${fileId}`],
  "First reference definition wins",
);

const rendered = render('![封面 **原样**](/_cms/digest.webp "*标题* `原样`")');
assert.match(
  rendered,
  /<img src="\/_cms\/digest\.webp" alt="封面 \*\*原样\*\*" title="\*标题\* `原样`" loading="lazy" decoding="async" style="max-width:100%;height:auto">/,
);
assert.equal(rendered.includes("<strong>"), false);
assert.equal(rendered.includes("<em>"), false);
assert.equal(rendered.includes("<code>"), false);
assert.match(
  render("![外链](https://images.example.test/image.png)"),
  /<img src="https:\/\/images\.example\.test\/image\.png" alt="外链"/,
);
assert.match(
  render("![local](</local/image with spaces.png>)"),
  /<img src="\/local\/image with spaces\.png" alt="local"/,
);
assert.match(
  render('![a](https://images.example.test/a.png "title") ![b](/b.png)'),
  /<img .*<img /,
);

const hostile = render(
  String.raw`![" onerror="alert(1) <script>&' **x**](/safe?x="&y=' "a\" onload=\"boom <script>&' _title_")`,
);
for (const source of ["./image.png", "images/x.webp", "../image.png"]) {
  assert.ok(render(`![local](${source})`).includes(`<img src="${source}"`));
}
assert.match(hostile, /src="\/safe\?x=&quot;&amp;y=&#39;"/);
assert.match(
  hostile,
  /alt="&quot; onerror=&quot;alert\(1\) &lt;script&gt;&amp;&#39; \*\*x\*\*"/,
);
assert.match(
  hostile,
  /title="a&quot; onload=&quot;boom &lt;script&gt;&amp;&#39; _title_"/,
);
assert.equal(hostile.includes("<script>"), false);
assert.equal(
  /"\s+on(?:error|load)=/.test(hostile),
  false,
  "Untrusted text must stay inside escaped attribute values",
);
assert.equal(hostile.includes("<strong>"), false);

for (const source of [
  "javascript:alert(1)",
  "data:text/html,evil",
  "vbscript:evil",
  "file:///private",
  "blob:https://example.test/id",
  "//external.example.test/x.png",
  String.raw`/\external.example.test/x.png`,
  `directus://${fileId}`,
  "https://name:password@example.test/x.png",
]) {
  const output = render(`![blocked](${source})`);
  assert.equal(output.includes("<img"), false, source);
  assert.ok(output.includes("blocked"));
}
for (const example of protectedExamples.filter(
  (item) => !item.startsWith("\\") && !item.startsWith(">"),
)) {
  assert.equal(
    render(example).includes("<img"),
    false,
    "Code samples must remain literal",
  );
}
const rawHtmlCode = `\`<img src="directus://${fileId}" onerror="bad">\``;
assert.equal(render(rawHtmlCode).includes("<img"), false);
assert.ok(render(rawHtmlCode).includes("&lt;img"));
for (const code of [
  `\`\`\`\`html\n\`\`\`\n<img src="/assets/${fileId}">\n\`\`\`\``,
  `\`\`\`html\n<img src="/assets/${fileId}">`,
  `~~~~html\n~~~\n<img src="/assets/${fileId}">\n~~~~`,
]) {
  assert.deepEqual(findUnsupportedMarkdownImageSources(code), []);
  assert.equal(render(code).includes("<img"), false);
  assert.ok(render(code).includes("&lt;"));
}
const escapedHtml = `\\<img src="/assets/${fileId}">`;
assert.deepEqual(findUnsupportedMarkdownImageSources(escapedHtml), []);
assert.equal(render(escapedHtml).includes("<img"), false);
assert.ok(render(escapedHtml).includes("&lt;img"));
assert.deepEqual(
  findUnsupportedMarkdownImageSources(
    `Ordinary prose directus://${fileId} and /assets/${fileId}.`,
  ),
  [],
);
assert.equal(
  render(`\`\`one \` <img src="/bad.png"> \` two\`\``).includes("<img"),
  false,
);
assert.ok(
  render("`![**literal**](/local.png)`").includes("![**literal**](/local.png)"),
);
const headingImages =
  '## Image ![Alt](/safe.png "Title")\n\n### `code` and ![Other](/other.png)';
const headingOutput = render(headingImages);
for (const heading of extractHeadings(headingImages)) {
  assert.ok(headingOutput.includes(`id="${heading.id}"`), heading.id);
}
assert.match(
  render("```text\ncode\n```\n## After code"),
  /<h2 id="after-code">After code<\/h2>/,
);
assert.match(
  render("## Heading\n\n**Bold** and *italic*\n\n![image](/image.png)"),
  /<h2 id="heading">Heading<\/h2>/,
);
assert.match(
  render("**Bold** and *italic*"),
  /<strong>Bold<\/strong> and <em>italic<\/em>/,
);
assert.match(
  render("\u0000markdown-image-0\u0000\n\n![image](/image.png)"),
  /<img src="\/image.png"/,
);

console.log(
  "Markdown image scanner, rewriting and real rendering checks passed.",
);
