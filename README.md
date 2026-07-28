# WP Builder

WP Builder is a GPL WordPress visual-builder foundation designed to coexist with any correctly implemented theme. It renders through `the_content`, uses capability-checked REST endpoints, and keeps its data in a versioned document format.

## Status

This repository contains milestone 0.1: plugin bootstrap, all-post-type editor entry, REST persistence, document validation, revision creation, and server-side rendering for the first layout/content elements. The visual drag-and-drop application and remaining widgets are roadmap work, not finished features.

## Principles

- Progressive enhancement and theme compatibility
- WordPress capabilities, nonces, escaping, and sanitization
- Accessible, semantic output
- Versioned documents with migrations
- Free core plus a separately licensed Pro add-on
- No lock-in: export and migration APIs are first-class

See [ROADMAP.md](ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
