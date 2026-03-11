# Frontend

Next.js 16 + React 19 + TypeScript frontend for CosmosPapers.

## Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000`. The backend API is expected at `http://localhost:8000` (proxied via Next.js config in production or Nginx).

## Pages

| Route         | File                          | Description                          |
|---------------|-------------------------------|--------------------------------------|
| `/`           | `src/app/page.tsx`            | Paper search, filters, and listing   |
| `/bookmarks`  | `src/app/bookmarks/page.tsx`  | Bookmarked papers + recommendations  |
| `/trends`     | `src/app/trends/page.tsx`     | BERTopic topic explorer and charts   |

## Key Components

| Component             | Description                                                 |
|-----------------------|-------------------------------------------------------------|
| `Navbar`              | Top navigation bar with links and branding                  |
| `PaperCard`           | Renders a single paper with title, authors, tags, actions   |
| `CopilotChat`         | AI chat panel — summarize, Q&A, BibTeX generation           |
| `CopilotChatWrapper`  | Lazy-loads CopilotChat to keep initial bundle small         |

## Hooks

- **`useBookmarks`** — Browser-cached bookmark store with add/remove/check helpers.

## Types

Paper and API response types are defined in [`src/types.ts`](src/types.ts).

## Build

```bash
npm run build
npm start
```

The production Docker image is built from [`Dockerfile`](Dockerfile).
