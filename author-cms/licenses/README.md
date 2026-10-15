# CMS runtime font notices

The CMS image adds Alpine 3.23 fontconfig 2.17.1-r0 and font-noto-cjk
0_git20220127-r1 for safe SVG display copies, including Chinese text. Fonts are
unmodified. The image builds its Fontconfig cache before switching to user node;
XDG_CACHE_HOME=/tmp/cms-font-cache provides a writable fallback on the /tmp tmpfs
when cached filesystem identities change across container layers.

- fontconfig-COPYING.txt is the complete COPYING member of the official Alpine
  source mirror's fontconfig-2.17.1.tar.xz archive.
- noto-cjk-OFL.txt contains the standard SIL OFL 1.1 text from the locked
  @fontsource/noto-serif-sc 5.3.1 license, without reusing that package's copyright
  header. The actual installed CJK font copyright and license name-table entries
  are appended by scripts/collect-runtime-font-notices.mjs at image build time.
- scripts/collect-license-notices.mjs includes the supplied texts in the CMS
  THIRD_PARTY_NOTICES.txt; the image smoke checks both notices and actual Latin /
  Chinese glyph rasterization.

Original SVG bytes remain authoritative. Different platform fonts/rasterizers can
produce different PNG display bytes; export/restore must preserve the selected
deployment's actual display file and the original SVG byte for byte.
