# Pagevia

Pagevia is created by **Mahfuzar Rahman** and published by [Web Ninja LLC](https://webninjallc.com). Product information is available at [Pagevia](https://webninjallc.com/plugins/pagevia).

Pagevia is a GPL WordPress visual-builder foundation designed to coexist with any correctly implemented theme. It renders through `the_content`, uses capability-checked REST endpoints, and keeps its data in a versioned document format.

## Status

Pagevia 1.3 hardens the release pipeline and supplies the extension foundation for Pagevia Pro popup and marketing widgets. The Free builder remains fully usable without Pro.

Existing `_wpb_*` documents and saved templates are migrated in bounded batches. Dynamic placeholders such as `{{post_title}}` and `{{meta:price}}` resolve through the licensed Pro add-on with safe literal fallbacks.

## Principles

- Progressive enhancement and theme compatibility
- WordPress capabilities, nonces, escaping, and sanitization
- Accessible, semantic output
- Versioned documents with migrations
- Free core plus a separately licensed Pro add-on
- No lock-in: export and migration APIs are first-class

See [ROADMAP.md](ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
