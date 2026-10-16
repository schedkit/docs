# Static images

These assets are served under `/img/`.

## Homepage artwork

`scheduler-shipment.svg` shows an OCI scheduler package arriving at a Linux host. The illustrated socket represents attachment through `sched_ext`; it is not a hardware component.

The homepage imports the SVG inline so its `--sk-*` colours follow the site theme. Colour fallbacks support standalone use. The file includes a title and description for screen readers and uses system fonts, without scripts or external images.

## Site assets

- `logo.svg` is used in the navbar.
- `social-card.png` is the OpenGraph/Twitter preview image; `social-card.svg` is its editable source.
- `favicon.ico` is referenced by `docusaurus.config.ts` but is missing. Add the file or remove the reference.
