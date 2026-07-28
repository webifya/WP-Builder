# WP Builder

WP Builder is a GPL WordPress visual-builder foundation designed to coexist with any correctly implemented theme. It renders through `the_content`, uses capability-checked REST endpoints, and keeps its data in a versioned document format.

## Status

Milestone 0.2 provides a usable frontend editing slice: element library, live canvas, nested elements, drag/reorder, navigator, inspector, responsive previews/styles, device visibility, selection, duplicate/delete, undo/redo, keyboard shortcuts and save-backed WordPress revisions.

This remains a development preview. Media-library selection, complete free-widget behavior, template workflows, autosave/recovery, formal accessibility review and the full automated compatibility matrix remain roadmap work.

## Principles

- Progressive enhancement and theme compatibility
- WordPress capabilities, nonces, escaping, and sanitization
- Accessible, semantic output
- Versioned documents with migrations
- Free core plus a separately licensed Pro add-on
- No lock-in: export and migration APIs are first-class

See [ROADMAP.md](ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
