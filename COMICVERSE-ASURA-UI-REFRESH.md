# ComicVerse — Asura-style UI refresh

This update applies the supplied ComicVerse Asura Figma reference to the existing app without replacing its architecture or application behavior.

## Visual direction

- Dark ink canvas: `#131118`; panels: `#1D1B28` and `#232130`.
- Asura purple brand accents: `#9333EA`, `#A855F7`, `#7E22CE`; purple gradient masthead.
- Primary text: `#F5F3FA`; muted text: `#A49FB5`; gold rating accent: `#FBBF24`.
- Poppins headings with Inter as the UI/body companion font.
- Rounded panels, compact comic-cover cards, subtle borders, responsive spacing, clear hover/focus states.

## Updated areas

- Shared site header and footer, including responsive account actions.
- Home page composition: featured cover rail, trending/latest content and popular sidebar.
- Browse hero, search/filter toolbar and responsive catalogue grid.
- Comic detail hero and description presentation.
- Comic cards and latest-update cards.
- Bookmarks cards with a visual reading-progress bar using existing progress data.
- Admin navigation grouped into Workspace, Catalogue, Community and Operations.
- Mobile/tablet layouts continue to use the existing bottom navigation and current route destinations.

## Behavior deliberately retained

Existing API calls, data models, authentication and role checks, URL/query state, search and filter behavior, bookmark operations, reading progress, chapter links, carousel interactions and page routes were not intentionally changed. The visual refresh reuses the current components and state logic.

## Setup

Copy the relevant `.env.example` files to the local environment filenames required by the app and fill in your own values. The delivery ZIP omits machine-specific secrets, local build caches, generated API output and the local SQL dump.

## Validation

Changed TSX files were syntax-transpiled successfully. A full Next.js build/typecheck was not run in this environment because the frontend dependencies are not installed in the project workspace. Run the normal install and build commands in your development environment before deployment.
