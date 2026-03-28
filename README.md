# Basemark

A minimal wiki for engineers. Dark-first, keyboard-driven, single-user.

## Prerequisites

- [Bun](https://bun.sh/) (or Node.js 20+)
- SQLite (bundled via better-sqlite3)

## Setup

1. Copy the environment file and set your password:

```bash
cp .env.local.example .env.local
# Edit .env.local and set AUTH_PASSWORD
```

2. Install dependencies:

```bash
bun install
```

3. Run database migrations:

```bash
bun run db:migrate
```

4. Start the dev server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server (Turbopack) |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run test` | Run tests (watch mode) |
| `bun run test:run` | Run tests (single pass) |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Apply database migrations |

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Editor:** Tiptap v2 (ProseMirror)
- **Database:** SQLite + Drizzle ORM
- **Search:** FTS5 full-text search
- **Styling:** Tailwind CSS v4
- **Auth:** Single-user password with session cookies

## Project Structure

```
src/
├── app/                 # Next.js pages and API routes
│   ├── api/             # REST API (documents, collections, search, share, auth)
│   ├── doc/[id]/        # Document editor page
│   ├── share/[token]/   # Public shared document view
│   └── login/           # Login page
├── components/
│   ├── editor/          # Tiptap editor, extensions, slash commands
│   ├── home/            # Home page with recent documents
│   ├── layout/          # App shell, sidebar, tab bar, status bar
│   ├── sidebar/         # Files tree, search view
│   └── ui/              # Command palette, context menu, dialogs
├── hooks/               # React hooks (useDocuments, useCollections, useSearch)
└── lib/                 # Auth, database, utilities
    └── db/              # Drizzle schema, SQLite setup, FTS
```
