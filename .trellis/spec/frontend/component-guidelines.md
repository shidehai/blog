# Frontend Component Guidelines

Server components load typed view models. Client components own CodeMirror,
preview, navigation/theme/search, code-copy and reading interactions. React/browser
state suffices; no global state library. Semantic classes need real CSS rules.
CMS visual direction is in author-cms/DESIGN.md; preserve public visual changes.

## Writing and images

CodeMirror owns cursor selection. Upload, file-drop, clipboard-image and library
insertion share one upload path, inserting escaped Markdown at cursor. Retain text
and alt on failures. Preview uses @blog/markdown, not an alternate grammar. Title
grows with content/viewport. Wide screens split edit/preview; mobile switches tabs
and must show the active mode correctly.

Save states use text; conflicts keep local text and offer reload/clone. Reload
requires confirmation. Publish waits for saves/images and locks on unknown outcome.
Leave guards include text, uploads and uncertain publication. Media dialog controls
cancel/close during upload; never discard an unfinished image silently.

## Accessibility/navigation

Use landmarks, labels, native controls, headings, alt text and visible focus.
Closed mobile sidebar is inert; open sidebar makes main inert with backdrop/Escape
close. State cannot rely only on color. Check reduced motion/narrow screens.
Search custom clear suppresses native duplicate controls.

Public content links disable prefetch. ContentFreshness owns generation checks
and document reload for changed content/history404. Search consumes current
PostSummary[]; pointer/keyboard/empty-query share one result array.
@blog/markdown alone owns code-copy and matching heading IDs. ArticleClient owns
progress/heading spy/share/adjacent/related links. No duplicate enhancements or
reconstruction of CMS state from window.location.
