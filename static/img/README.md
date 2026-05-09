# Static images

This directory holds static assets served at the site root. The site config currently expects:

- `logo.svg` — used in the navbar. A placeholder is committed; replace it with a real logo when one exists.
- `favicon.ico` — favicon. **Not yet committed.** Generate one (e.g. with [realfavicongenerator.net](https://realfavicongenerator.net/)) and drop it here, or remove the `favicon` reference from `docusaurus.config.ts` until you have one.
- `social-card.png` — used as the OpenGraph/Twitter card image. **Not yet committed.** A 1200×630 PNG is the standard size.

Until `favicon.ico` and `social-card.png` exist, the build will succeed but the social/favicon experience will be empty. That's fine for an internal preview but worth fixing before the site goes wide.
