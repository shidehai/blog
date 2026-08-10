# Reference category measurements

Measured in Chromium on 2026-08-10 from `https://aiayy.cn/category`. These
values document layout behavior only; no reference assets or source code are
used.

## Desktop (1440px viewport)

- Outer container: 1200px with 32px inline padding.
- Header: 32px/51.2px title, 16px/25.6px subtitle, 64px bottom margin.
- Category grid: 900px wide, three 284px columns, 24px gap.
- Card: 284px by about 234px, 48px/32px padding, 30px radius, raised paired
  shadow.
- Marker: 64px square, 16px radius, 24px bottom margin.
- Name: 16px/25.6px, 700 weight. Count: 13px/20.8px.

## Mobile (390px viewport)

- Outer inline gutter: 24px.
- Grid: one 342px column with a 24px gap.
- Title, subtitle, card, marker, name, and count sizes stay unchanged.

## Local adaptation

Reuse the project's already calibrated surface, ink, signal, radius, and shadow
tokens. Use topic-specific local text markers and existing topic content/routes;
do not reuse reference icons, identity, copy, assets, or implementation.
