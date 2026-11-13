# Reusable prompt — ComicVerse Asura UI/UX redesign

You are working inside the existing ComicVerse repository. Treat the supplied **ComicVerse Asura Figma design HTML** as the visual source of truth and upgrade the current application UI/UX to match it as closely as practical.

## Core requirement

Improve the presentation of the existing ComicVerse app using its existing components, routes, data, API contracts and state logic. This is a visual/layout redesign, not a rewrite. Preserve all currently working behavior.

## Design reference

Follow the Asura-inspired design language in the attached Figma reference:

- Dark ink background `#131118`, secondary surface `#17141F`, panel `#1D1B28`, elevated panel `#232130`.
- Purple brand palette: `#9333EA`, `#A855F7`, `#7E22CE`; use a purple gradient masthead similar to `#7E2BD8 → #9338EE → #8B3EE8`.
- Main text `#F5F3FA`, muted text `#A49FB5`, gold rating accent `#FBBF24`, success `#34D399`.
- Poppins for headings/brand typography and Inter for interface/body text.
- Rounded 8–12px panels, subtle borders, compact cover art, restrained shadows, clear focus/hover states and consistent spacing.

## Pages and components to refine

1. Shared navigation/header, search, account actions, dropdowns, footer and mobile bottom navigation.
2. Home: featured comic-cover rail, trending comics, latest chapter updates, popular rankings/sidebar and recently added series.
3. Browse: title/search hero, filter controls, sort, active-filter chips, pagination and responsive comic grid.
4. Comic detail: cover/hero, metadata, genres, description, actions and chapter list.
5. Reader: preserve the current immersive reading experience and all reader controls; only adjust visual styling where appropriate.
6. Bookmarks/library: status tabs, search/sort, continue-reading affordances and reading-progress indicators.
7. Admin: grouped navigation, dashboard, catalogue, chapters, genres, sources, creators, reviews/reports, users, announcements, analytics and audit screens.
8. Account/profile and other existing pages: apply the same tokens and component styling without removing existing features.

## Non-negotiable behavior constraints

- Do not remove or rename existing routes, components, props, database fields, API endpoints or response shapes.
- Do not change authentication, authorization, admin guards, data fetching, persistence, search/filter semantics, bookmark operations, reading progress, notifications, chapter navigation or business rules.
- Reuse the current React/Next.js components and existing state/hooks. Add presentation wrappers/classes where needed; do not duplicate business logic.
- Keep all existing actions functional. Do not replace functional controls with decorative mockups or static screenshots.
- Keep desktop, tablet and mobile responsive. Preserve keyboard access, visible focus, semantic HTML, accessible names and reduced-motion behavior.
- Do not add dependencies unless truly necessary; prefer the current Tailwind/CSS/component setup.
- Do not hardcode demo content in place of real API-backed data.

## Workflow

1. Inspect the full repository and the supplied Figma reference before editing.
2. Map each existing route/component to its closest reference frame.
3. Establish shared design tokens and reusable styles first; then refine the existing page components.
4. Keep the diff focused on UI/UX and preserve all application logic.
5. Run formatting, lint, typecheck, tests and production build where the environment permits. Fix any regressions.
6. Summarize files changed, behavior kept intact, validation performed and any checks blocked by missing dependencies or configuration.

## Acceptance criteria

- The app has a coherent Asura-inspired dark-purple visual system across reader and admin surfaces.
- The top navigation, content panels, comic cards, browse filters, detail view, bookmark library and admin navigation visibly reflect the Figma reference.
- Layouts work at desktop, tablet and mobile widths without clipped controls or inaccessible navigation.
- Existing links, state transitions, filters, forms, API requests, bookmark actions and reader controls still behave as before.
- Deliver the complete updated project as a ZIP, excluding private `.env` files, credentials, database dumps and generated build caches. Include a concise change summary and the exact validation results.
