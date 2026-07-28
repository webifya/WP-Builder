# Architecture

## Content model

Each built document lives in `_wpb_document` post meta:

```json
{"version":1,"settings":{},"elements":[{"id":"...","type":"section","props":{},"styles":{},"children":[]}]}
```

The schema is deliberately platform-neutral. New schema versions require forward migrations; renderers must tolerate unknown properties.

## Compatibility contract

The free plugin owns document storage, shared controls, frontend rendering, and extension APIs. Pro depends on free and registers extra element types and services through hooks. Output is inserted via WordPress's normal content filter so the active theme retains headers, footers, templates, SEO integrations, and post context.

“Works with all themes” means compatibility with themes that follow WordPress APIs; no plugin can guarantee correct behavior with arbitrary themes that bypass those APIs.

## Security

REST writes require `edit_post`, REST-cookie nonce authentication, bounded nesting/size, allow-listed element types, sanitization on write, and escaping on render. Raw JavaScript, custom PHP, and privileged HTML are not accepted by the free document endpoint.

## Planned packages

- Editor application: React/WordPress components, command history, canvas bridge, navigator
- Core: registry, documents, responsive values, design tokens
- Renderer: PHP SSR with optional hydrated interactivity
- Templates: portable signed JSON format
- Pro: theme locations, dynamic data, commerce, marketing, AI, teams

## Recovery and portability

Unsaved documents are copied to origin-scoped browser storage after changes. A successful server save clears the recovery copy. Exported templates use a versioned JSON envelope and are validated before import; the REST document sanitizer remains the final trust boundary.

Builder post meta participates in WordPress revisions. Revision listing and restoration require the same `edit_post` capability as normal document writes, and restoration verifies parent ownership before copying data.
