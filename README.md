# WP Builder

WP Builder is a GPL WordPress visual-builder foundation designed to coexist with any correctly implemented theme. It renders through `the_content`, uses capability-checked REST endpoints, and keeps its data in a versioned document format.

## Status

Milestone 0.4 adds a reusable server-side template library, accessible tabs/accordion/toggle widgets, flex/grid controls and a reliability hardening pass.

The hardening pass fixes Media Library modal visibility, external-image rendering, drag-to-nest behavior and unbounded document payloads. This remains a development preview; complete free-widget behavior, formal accessibility review and the full automated compatibility matrix remain roadmap work.

## Principles

- Progressive enhancement and theme compatibility
- WordPress capabilities, nonces, escaping, and sanitization
- Accessible, semantic output
- Versioned documents with migrations
- Free core plus a separately licensed Pro add-on
- No lock-in: export and migration APIs are first-class

See [ROADMAP.md](ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
