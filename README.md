# WP Builder

WP Builder is a GPL WordPress visual-builder foundation designed to coexist with any correctly implemented theme. It renders through `the_content`, uses capability-checked REST endpoints, and keeps its data in a versioned document format.

## Status

Milestone 0.3 adds daily-use editing workflows to the visual foundation: local recovery, copy/paste and contextual actions, WordPress Media Library selection, portable page-template JSON, global color/type tokens, and revision browsing/restoration.

This remains a development preview. Complete free-widget behavior, saved server-side template libraries, formal accessibility review and the full automated compatibility matrix remain roadmap work.

## Principles

- Progressive enhancement and theme compatibility
- WordPress capabilities, nonces, escaping, and sanitization
- Accessible, semantic output
- Versioned documents with migrations
- Free core plus a separately licensed Pro add-on
- No lock-in: export and migration APIs are first-class

See [ROADMAP.md](ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
