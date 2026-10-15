# Dependency inventory

Recorded 2026-10-15 from installed package.json metadata and the checked pnpm-lock.yaml. Versions below are the resolved versions.

| Dependency | Resolved version | Declared license |
| --- | --- | --- |
| `next` | 15.5.28 | MIT |
| `react` | 19.2.8 | MIT |
| `zod` | 4.4.3 | MIT |
| `pg` | 8.23.1 | MIT |
| `drizzle-orm` | 0.45.4 | Apache-2.0 |
| `sharp` | 0.35.5 | Apache-2.0 |
| `postcss` | 8.5.30 | MIT |
| `source-map-js` | 1.2.2 | BSD-3-Clause |
| `lucide-react` | 0.475.0 | ISC |
| `@codemirror/commands` | 6.11.1 | MIT |
| `@codemirror/lang-markdown` | 6.5.2 | MIT |
| `@codemirror/language` | 6.13.1 | MIT |
| `@codemirror/state` | 6.7.6 | MIT |
| `@codemirror/view` | 6.43.14 | MIT |
| `@fontsource-variable/inter` | 5.3.0 | OFL-1.1 |
| `@fontsource-variable/jetbrains-mono` (public site) | 5.3.0 | OFL-1.1 |
| `@fontsource/noto-serif-sc` | 5.3.1 | OFL-1.1 |
| `unified` | 11.0.5 | MIT |
| `remark-parse` | 11.0.0 | MIT |
| `remark-gfm` | 4.0.1 | MIT |
| `remark-rehype` | 11.1.2 | MIT |
| `rehype-raw` | 7.0.0 | MIT |
| `rehype-sanitize` | 6.0.0 | MIT |
| `rehype-highlight` | 7.0.2 | MIT |
| `rehype-stringify` | 10.0.1 | MIT |
| `unist-util-visit` | 5.1.0 | MIT |
| `vfile` | 6.0.3 | MIT |

Sharp includes native `@img/sharp-libvips-linux-x64` and `@img/sharp-libvips-linuxmusl-x64` 1.3.4 (libvips 8.18.7), whose installed metadata declares LGPL-3.0-or-later. Retain the supplied native-library license/copyright notices when distributing images; Sharp's own Apache-2.0 label does not describe all its bundled native libraries. Fonts remain unmodified and retain OFL metadata. Public Inter/JetBrains Mono now build locally from Fontsource; Google Fonts is no longer a build dependency.

The Directus SDK has been removed from the entire workspace and lockfile. Offline source snapshot conversion uses application-owned code without the former platform runtime. Next stays on the 15.x patch line; Sharp/native libraries, PostCSS and source-map-js have the security patches verified by the 2026-10-15 production audit. CodeMirror, unified and Drizzle/pg provide editor, Markdown and database primitives with application-owned fields and workflow. `@playwright/test` 1.62.1 is development-only and runs a single sequential isolated browser regression through `test:runtime --browser`.

Both Docker targets run scripts/collect-license-notices.mjs after installing the
locked workspace and building. The image retains /app/THIRD_PARTY_NOTICES.txt
with supplied root license/copyright files and sharp-libvips README dependency
notices. The inventory includes build dependencies; image smoke checks verify
the notices are present. Regenerate from the lockfile rather than editing
third-party license text.

Recorded 2026-10-15 for the Alpine 3.23 CMS runtime: fontconfig 2.17.1-r0
(COPYING terms in licenses/fontconfig-COPYING.txt) and font-noto-cjk
0_git20220127-r1 (OFL-1.1). They fix missing SVG text, including Chinese.
Fonts are unmodified. Standard OFL text and Fontconfig COPYING are collected from
author-cms/licenses; actual font copyright/license metadata is extracted from the
installed SFNT name tables by scripts/collect-runtime-font-notices.mjs and appended
to the image notices. The image smoke verifies both notices and glyph rendering.
The runtime font package adds about 88 MiB; this is required for the migration's
SVG display copies. Browser uploads still accept the documented raster formats.

The application runtime base is Node 24.22.0 on Alpine 3.23. The 2026-10-15
container scan found OpenSSL and bundled global npm-toolchain advisories in the
previous base. The replacement carries libcrypto3/libssl3 3.5.8-r0; runtime stages
remove npm, Corepack and Yarn, while build/development stages keep package managers.
Both runtime smokes verify the Node patch and absence of those toolchain trees;
the final actual images must also pass the current Trivy HIGH/CRITICAL gate.
