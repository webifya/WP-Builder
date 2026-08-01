# Changelog

## 1.2.0

- Added extensible editor widget types, default properties, and inspector controls.
- Added the `pagevia/render_element` server-rendering contract for Pro and third-party widgets.
- Added browser coverage for extension-provided widgets.

## 1.1.0

- Added a page-level design system with custom breakpoints, spacing scale, and CSS variables.
- Added global per-widget styles, reusable style presets, and semantic CSS classes.
- Replaced desktop inline element styling with safe generated CSS so responsive overrides cascade correctly.

## 1.0.0

- Added conflict-safe server autosave while preserving undo history.
- Added visual unit selectors and constrained Flex/Grid controls.
- Added keyboard-accessible layer ordering and RTL editor layout.
- Added automatic version upgrades and translation loading.
- Added editor interaction coverage to the browser test suite.

## 0.9.0

- Added the production Theme Builder canvas and template resolution engine.
- Added visual header, footer, singular, archive, search and 404 templates.
- Added include/exclude conditions, priorities and safe site fallbacks.
- Exposed reusable document rendering for Pro theme locations.

## 0.8.0

- Rebranded all public identifiers, namespaces, assets, hooks and storage keys to Pagevia.
- Added batched migration of legacy builder documents.
- Connected rendered `{{dynamic_tag}}` placeholders to Pagevia Pro resolvers.
- Added the official Pagevia Pro upgrade URL.

## 0.5.0

- Completed the initial Free widget families: icon box, gallery, counter, rating and social links.
- Added semantic output and lazy image loading.
- Added PHP-version CI, JavaScript browser tests, WordPress Playground configuration and release exclusions.

## 0.4.0

### Added

- Server-side private template library with capability-checked REST operations
- Insert, save and delete template workflows in the visual editor
- Accessible tabs with keyboard navigation
- Semantic accordion and toggle widgets
- Flex and grid style controls
- Two-megabyte and 2,000-element document limits
- Dedicated frontend widget assets

### Fixed

- Media Library modals are no longer hidden by the editor shell
- External image URLs render when no WordPress attachment ID exists
- Existing elements can be dropped into container elements
- Dragging a parent into its own descendant is rejected
- Frontend assets are enqueued before the theme head is printed

## 0.3.0

- Added recovery, clipboard actions, portable JSON templates, global design tokens and revision restoration.

## 0.2.0

- Added the first usable frontend visual editor.

## 0.1.0

- Added the secure plugin, document and rendering foundation.
