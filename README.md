# Pagevia

Pagevia is a GPL WordPress visual-builder foundation designed to coexist with any correctly implemented theme. It renders through `the_content`, uses capability-checked REST endpoints, and keeps its data in a versioned document format.

## Status

Pagevia 1.1 adds a production design system to the stable Free builder: customizable responsive breakpoints, spacing and variable tokens, global widget styles, reusable style presets, and semantic CSS classes. Generated frontend CSS preserves the correct desktop/tablet/mobile cascade across themes.

Existing `_wpb_*` documents and saved templates are migrated in bounded batches. Dynamic placeholders such as `{{post_title}}` and `{{meta:price}}` resolve through the licensed Pro add-on with safe literal fallbacks.

## Principles

- Progressive enhancement and theme compatibility
- WordPress capabilities, nonces, escaping, and sanitization
- Accessible, semantic output
- Versioned documents with migrations
- Free core plus a separately licensed Pro add-on
- No lock-in: export and migration APIs are first-class

See [ROADMAP.md](ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
