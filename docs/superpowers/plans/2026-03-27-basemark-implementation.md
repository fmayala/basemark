# Basemark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal, keyboard-first wiki with Obsidian Baseline aesthetics and Outline-like block editing.

**Architecture:** Next.js App Router serves both the React SPA and API routes. Tiptap v2 provides the block editor. SQLite via Drizzle ORM stores documents, collections, and share links. Single-user auth with password from env var. CSS custom properties for theming.

**Tech Stack:** Next.js 15, React 19, Tiptap v2, Drizzle ORM, better-sqlite3, Bun, TypeScript

---

## File Structure

```
basemark/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout, fonts, theme provider
│   │   ├── page.tsx                   # Home page (recents + new doc prompt)
│   │   ├── globals.css                # CSS custom properties, base reset
│   │   ├── login/
│   │   │   └── page.tsx               # Login page
│   │   ├── doc/
│   │   │   └── [id]/
│   │   │       └── page.tsx           # Document editor page
│   │   ├── share/
│   │   │   └── [token]/
│   │   │       └── page.tsx           # Public read-only shared doc
│   │   └── api/
│   │       ├── auth/
│   │       │   └── route.ts           # POST login, DELETE logout
│   │       ├── documents/
│   │       │   ├── route.ts           # GET list, POST create
│   │       │   └── [id]/
│   │       │       └── route.ts       # GET, PUT, DELETE single doc
│   │       ├── collections/
│   │       │   ├── route.ts           # GET list, POST create
│   │       │   └── [id]/
│   │       │       └── route.ts       # GET, PUT, DELETE single collection
│   │       ├── search/
│   │       │   └── route.ts           # GET full-text search
│   │       └── share/
│   │           ├── route.ts           # POST create share link
│   │           └── [token]/
│   │               └── route.ts       # GET resolve share token to doc
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts              # DB client singleton
│   │   │   ├── schema.ts             # Drizzle table definitions
│   │   │   └── fts.ts                # FTS5 setup + sync triggers (raw SQL)
│   │   ├── auth.ts                   # Auth helpers (verify password, session mgmt)
│   │   └── text.ts                   # Plain text extraction from Tiptap JSON
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx          # Top-level layout: sidebar + tabs + content
│   │   │   ├── Sidebar.tsx           # Sidebar with Files/Search views
│   │   │   ├── TabBar.tsx            # Tab strip with inverse rounded corners
│   │   │   └── StatusBar.tsx         # Bottom bar (word count, backlinks)
│   │   ├── editor/
│   │   │   ├── Editor.tsx            # Tiptap editor wrapper
│   │   │   ├── extensions.ts         # All Tiptap extensions configured
│   │   │   ├── CalloutExtension.ts   # Custom callout node extension
│   │   │   ├── SlashCommand.tsx      # Slash command menu (suggestion plugin)
│   │   │   └── DocTitle.tsx          # Instrument Serif editable title
│   │   ├── sidebar/
│   │   │   ├── FilesView.tsx         # Collection tree with docs
│   │   │   ├── SearchView.tsx        # Search input + results
│   │   │   └── CollectionTree.tsx    # Recursive tree with chevrons
│   │   ├── home/
│   │   │   └── HomePage.tsx          # Landing page with recents
│   │   ├── share/
│   │   │   └── ShareDialog.tsx       # Share link creation dialog
│   │   └── ui/
│   │       ├── CommandPalette.tsx     # Ctrl+K command palette
│   │       └── ContextMenu.tsx       # Right-click context menu
│   └── hooks/
│       ├── useDocuments.ts           # Fetch hooks for documents API
│       ├── useCollections.ts         # Fetch hooks for collections API
│       ├── useSearch.ts              # Search hook with debounce
│       └── useKeyboardShortcuts.ts   # Global keyboard shortcut handler
├── drizzle.config.ts                 # Drizzle kit config
├── drizzle/                          # Generated migrations
├── basemark.db                       # SQLite database file (gitignored)
├── next.config.ts                    # Next.js config
├── tsconfig.json
├── package.json
├── .env.local                        # AUTH_PASSWORD, etc.
└── .gitignore
```

---

## Task 1: Project Scaffold + Database

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `drizzle.config.ts`, `.env.local`, `.gitignore`
- Create: `src/lib/db/schema.ts`, `src/lib/db/index.ts`, `src/lib/db/fts.ts`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`

- [ ] **Step 1: Initialize project**

```bash
cd C:/tmp/outline-mini
bun init -y
bun add next@latest react@latest react-dom@latest
bun add drizzle-orm better-sqlite3
bun add -d drizzle-kit @types/better-sqlite3 @types/react @types/react-dom typescript @types/node
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
```

- [ ] **Step 4: Create .env.local**

```
AUTH_PASSWORD=changeme
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
.next/
basemark.db
.env.local
```

- [ ] **Step 6: Create drizzle.config.ts**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./basemark.db",
  },
});
```

- [ ] **Step 7: Create database schema — src/lib/db/schema.ts**

```typescript
import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("Untitled"),
  content: text("content").default("{}"),
  collectionId: text("collection_id").references(() => collections.id),
  sortOrder: real("sort_order").default(0),
  createdAt: integer("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});

export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  color: text("color"),
  sortOrder: real("sort_order").default(0),
  createdAt: integer("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});

export const shareLinks = sqliteTable("share_links", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "number" }),
  createdAt: integer("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  expiresAt: integer("expires_at", { mode: "number" }).notNull(),
});
```

- [ ] **Step 8: Create DB client singleton — src/lib/db/index.ts**

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { setupFTS } from "./fts";

const sqlite = new Database("basemark.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

setupFTS(sqlite);

export { sqlite };
```

- [ ] **Step 9: Create FTS5 setup — src/lib/db/fts.ts**

```typescript
import type Database from "better-sqlite3";

export function setupFTS(db: Database.Database) {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      id UNINDEXED,
      title,
      content_text
    );
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS documents_fts_insert AFTER INSERT ON documents BEGIN
      INSERT INTO documents_fts(id, title, content_text)
      VALUES (NEW.id, NEW.title, '');
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS documents_fts_update AFTER UPDATE ON documents BEGIN
      UPDATE documents_fts SET title = NEW.title WHERE id = NEW.id;
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS documents_fts_delete AFTER DELETE ON documents BEGIN
      DELETE FROM documents_fts WHERE id = OLD.id;
    END;
  `);
}

export function updateFTSContent(db: Database.Database, docId: string, plainText: string) {
  db.prepare("UPDATE documents_fts SET content_text = ? WHERE id = ?").run(plainText, docId);
}
```

- [ ] **Step 10: Generate and run initial migration**

```bash
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

- [ ] **Step 11: Create globals.css — src/app/globals.css**

Full CSS with Baseline theme tokens, scrollbar styles, selection color. See the design spec's Theme System section for all custom properties. Include the `@import` for Instrument Serif and JetBrains Mono from Google Fonts.

- [ ] **Step 12: Create root layout — src/app/layout.tsx**

Standard Next.js root layout importing globals.css, setting metadata title "Basemark".

- [ ] **Step 13: Create placeholder home page — src/app/page.tsx**

Centered "Basemark" in Instrument Serif on `#262626` background. Just enough to verify the app runs.

- [ ] **Step 14: Update package.json scripts**

Add: `dev` (next dev --turbopack), `build` (next build), `start` (next start), `db:generate` (drizzle-kit generate), `db:migrate` (drizzle-kit migrate).

- [ ] **Step 15: Verify it runs**

```bash
bun run dev
```

Open http://localhost:3000 — should see "Basemark" centered.

- [ ] **Step 16: Commit**

```bash
git init && git add -A
git commit -m "feat: project scaffold with Next.js, Drizzle, SQLite, and Baseline theme tokens"
```

---

## Task 2: Auth System

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/route.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/middleware.ts`

- [ ] **Step 1: Add nanoid**

```bash
bun add nanoid
```

- [ ] **Step 2: Create auth helpers — src/lib/auth.ts**

Functions: `verifyPassword(password)` checks against `AUTH_PASSWORD` env var. `createSession()` inserts a session row with nanoid token and 30-day expiry, returns token. `validateSession(token)` checks token exists and not expired. `validateBearerToken(authHeader)` extracts and validates bearer token.

- [ ] **Step 3: Create auth API route — src/app/api/auth/route.ts**

POST: accepts `{ password }`, verifies, creates session, sets httpOnly cookie. DELETE: clears the session cookie.

- [ ] **Step 4: Create login page — src/app/login/page.tsx**

Client component. Password input, submit calls POST /api/auth, redirect to / on success. Styled with Baseline theme: `#1e1e1e` background, `#2a2a2a` input, accent button.

- [ ] **Step 5: Create Next.js middleware — src/middleware.ts**

Edge middleware: allows `/login`, `/share/*`, `/api/auth`, `/api/share/*`, `/_next/*` through. Everything else checks for `session` cookie — redirects to `/login` if missing. Note: only checks cookie existence at edge, full validation in API routes.

- [ ] **Step 6: Verify login flow**

Open http://localhost:3000, should redirect to /login. Enter "changeme", should redirect to home.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: single-user auth with password login and session cookies"
```

---

## Task 3: Documents + Collections API

**Files:**
- Create: `src/app/api/documents/route.ts`, `src/app/api/documents/[id]/route.ts`
- Create: `src/app/api/collections/route.ts`, `src/app/api/collections/[id]/route.ts`
- Create: `src/app/api/search/route.ts`

- [ ] **Step 1: Documents list + create — src/app/api/documents/route.ts**

GET: returns all documents ordered by updatedAt desc. POST: creates document with nanoid, returns 201.

- [ ] **Step 2: Single document CRUD — src/app/api/documents/[id]/route.ts**

GET: find by id, 404 if missing. PUT: partial update, set updatedAt to now. DELETE: remove document.

- [ ] **Step 3: Collections list + create — src/app/api/collections/route.ts**

GET: returns all collections ordered by sortOrder. POST: creates with nanoid.

- [ ] **Step 4: Single collection CRUD — src/app/api/collections/[id]/route.ts**

GET, PUT, DELETE — same pattern as documents.

- [ ] **Step 5: Search API — src/app/api/search/route.ts**

GET with `?q=query`. Uses raw SQLite query against documents_fts with `MATCH` and `snippet()` for highlighted results. Returns `{ id, title, snippet }[]`.

- [ ] **Step 6: Verify APIs with curl**

Test create collection, create document, list, search.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: CRUD API routes for documents, collections, and FTS search"
```

---

## Task 4: App Shell (Sidebar + Tabs + Layout)

**Files:**
- Create: `src/components/layout/AppShell.tsx`, `Sidebar.tsx`, `TabBar.tsx`, `StatusBar.tsx`
- Create: `src/components/sidebar/FilesView.tsx`, `SearchView.tsx`, `CollectionTree.tsx`
- Create: `src/hooks/useDocuments.ts`, `useCollections.ts`, `useSearch.ts`

This is the largest task. Follow the v11 mockup from the brainstorm session. Key rules:

- Sidebar `#262626`, content `#1e1e1e`, tab bar `#262626`
- Active tab `#1e1e1e` with inverse rounded corners (concave `::before`/`::after` with `box-shadow`)
- Content top-left has inverse rounded corner where sidebar meets content
- Panel icon on tab row next to first tab (not in sidebar zone)
- Sidebar fully collapsible, state persisted to localStorage
- Files/Search view switcher with underline-style active indicator
- CollectionTree: chevrons for expand/collapse, active doc gets `rgba(255,255,255,0.06)` rounded bg, all docs same 11px size
- SearchView: input + results with highlighted match snippets
- StatusBar: word count, character count at bottom right, `#3f3f3f` text

- [ ] **Step 1: Create data hooks** (useDocuments, useCollections, useSearch)
- [ ] **Step 2: Create AppShell** — manages sidebarOpen, activeDocId, openTabs state
- [ ] **Step 3: Create TabBar** — panel icon + tabs + inverse corners
- [ ] **Step 4: Create Sidebar** — view switcher + renders FilesView or SearchView
- [ ] **Step 5: Create FilesView** — collection tree grouped by collection
- [ ] **Step 6: Create CollectionTree** — recursive tree items with chevrons
- [ ] **Step 7: Create SearchView** — search input + debounced results
- [ ] **Step 8: Create StatusBar** — word/char count
- [ ] **Step 9: Wire AppShell into layout** for authenticated routes
- [ ] **Step 10: Verify visual shell** — sidebar toggle, tabs, inverse corners
- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: app shell with sidebar, tabs, and Baseline theme layout"
```

---

## Task 5: Tiptap Editor

**Files:**
- Create: `src/components/editor/Editor.tsx`, `extensions.ts`, `CalloutExtension.ts`, `DocTitle.tsx`
- Create: `src/app/doc/[id]/page.tsx`

- [ ] **Step 1: Install Tiptap packages**

```bash
bun add @tiptap/react @tiptap/core @tiptap/pm @tiptap/starter-kit \
  @tiptap/extension-code-block-lowlight lowlight \
  @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header \
  @tiptap/extension-task-list @tiptap/extension-task-item \
  @tiptap/suggestion tippy.js \
  @tiptap/extension-placeholder @tiptap/extension-typography \
  @tiptap/extension-underline @tiptap/extension-link
```

- [ ] **Step 2: Create extensions config — src/components/editor/extensions.ts**

Configure StarterKit (disable built-in codeBlock), add CodeBlockLowlight with lowlight common languages, Table + TableRow + TableCell + TableHeader, TaskList + TaskItem (nested), Placeholder, Typography, Underline, Link, and the custom CalloutExtension.

- [ ] **Step 3: Create CalloutExtension — src/components/editor/CalloutExtension.ts**

Custom Node: name "callout", group "block", content "block+". Attribute `type` (info/warning/tip/success). Renders as `<div class="callout" data-callout-type="...">`.

- [ ] **Step 4: Create Editor component — src/components/editor/Editor.tsx**

Uses `useEditor` with extensions, accepts `content` (JSON string) and `onUpdate` callback. Sets editor content from prop, fires onUpdate with stringified JSON.

- [ ] **Step 5: Create DocTitle — src/components/editor/DocTitle.tsx**

Auto-resizing textarea. Instrument Serif, 34px, weight 400. Calls onChange on input.

- [ ] **Step 6: Create document page — src/app/doc/[id]/page.tsx**

Fetches document by id, renders DocTitle + Editor. Auto-saves title on change, content on update with 500ms debounce. Centered at 720px max-width with 48px padding.

- [ ] **Step 7: Add editor CSS to globals.css**

Styles for `.basemark-editor`: headings (H1 2em, H2 1.5em with border-top, H3 1.25em), code blocks (#242424 bg, 8px radius, JetBrains Mono), inline code (#2a2a2a bg, orange text), callouts (colored left border + tinted bg per type), tables (collapse, #2a2a2a header bg), task lists (accent checkbox), blockquotes (3px left border), horizontal rules, links (accent, underline offset), placeholder text.

- [ ] **Step 8: Verify editor**

Create doc via API, navigate to /doc/ID, verify Tiptap editor with Baseline styling.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: Tiptap block editor with code blocks, tables, callouts, and Baseline styling"
```

---

## Task 6: Home Page

**Files:**
- Create: `src/components/home/HomePage.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create HomePage — src/components/home/HomePage.tsx**

Uses useDocuments and useCollections hooks. Shows: centered "Basemark" in Instrument Serif, "What's on your mind?" subtitle, click-to-write box (creates new doc on click, shows Ctrl+N hint), recent docs list (title, collection name, relative time, most recent brighter).

- [ ] **Step 2: Update page.tsx to render HomePage**
- [ ] **Step 3: Verify home page**
- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: home page with new doc prompt and recent docs"
```

---

## Task 7: Slash Commands

**Files:**
- Create: `src/components/editor/SlashCommand.tsx`
- Modify: `src/components/editor/extensions.ts`

- [ ] **Step 1: Create SlashCommand — src/components/editor/SlashCommand.tsx**

Uses `@tiptap/suggestion` with `/` trigger. Commands: heading 1-3, code block, table, callout (info/warning/tip/success), todo list, divider. Renders popup via tippy.js. Arrow keys navigate, Enter inserts, Escape closes. Styled: `#262626` bg, `#363636` selected, 8px radius.

- [ ] **Step 2: Register in extensions.ts**

Import and add the slash command suggestion extension.

- [ ] **Step 3: Add slash menu CSS to globals.css**

`.slash-menu` (bg, border, shadow, radius), `.slash-menu-item` (padding, hover, selected state).

- [ ] **Step 4: Verify** — type `/` in editor, select a command
- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: slash command menu for inserting blocks"
```

---

## Task 8: Keyboard Shortcuts + Command Palette

**Files:**
- Create: `src/hooks/useKeyboardShortcuts.ts`, `src/components/ui/CommandPalette.tsx`

- [ ] **Step 1: Create useKeyboardShortcuts — src/hooks/useKeyboardShortcuts.ts**

Takes a map of `{ "ctrl+k": () => void }`, listens for keydown, matches modifier+key combos, calls handler and preventDefault.

- [ ] **Step 2: Create CommandPalette — src/components/ui/CommandPalette.tsx**

Modal overlay: `#262626` bg, centered, `#2a2a2a` input. Searches documents by title + actions (New doc, Toggle sidebar). Arrow keys navigate, Enter executes, Escape closes. Fuzzy match on title.

- [ ] **Step 3: Wire into AppShell**

`ctrl+k` opens palette, `ctrl+n` creates new doc, `ctrl+p` opens palette in file mode, `ctrl+shift+f` switches to search view, `ctrl+\` toggles sidebar.

- [ ] **Step 4: Verify** — Ctrl+K opens palette, type doc name, Enter opens it
- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: keyboard shortcuts and command palette"
```

---

## Task 9: Sharing

**Files:**
- Create: `src/app/api/share/route.ts`, `src/app/api/share/[token]/route.ts`
- Create: `src/app/share/[token]/page.tsx`
- Create: `src/components/share/ShareDialog.tsx`

- [ ] **Step 1: Share link API — src/app/api/share/route.ts**

POST: accepts `{ documentId, expiresAt? }`, creates share_links row with nanoid(16) token, returns `{ token, url }`.

- [ ] **Step 2: Share token resolver — src/app/api/share/[token]/route.ts**

GET: finds share link by token, checks expiry, returns the document. 404 if not found, 410 if expired.

- [ ] **Step 3: Shared doc page — src/app/share/[token]/page.tsx**

Fetches doc via /api/share/[token]. Renders Tiptap editor with `editable: false`. Same Baseline styling. No sidebar, no tabs — just centered document with title.

- [ ] **Step 4: ShareDialog — src/components/share/ShareDialog.tsx**

Modal: "Create share link" button, shows generated URL with copy button. Optional expiration.

- [ ] **Step 5: Verify** — create share link, open in incognito, see read-only doc
- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: document sharing via token URLs"
```

---

## Task 10: Context Menu + Doc Linking

**Files:**
- Create: `src/components/ui/ContextMenu.tsx`
- Modify: `src/components/editor/extensions.ts`

- [ ] **Step 1: Create ContextMenu — src/components/ui/ContextMenu.tsx**

Right-click menu for sidebar items: Rename, Move to..., Share, Delete (red). Styled: `#2a2a2a` bg, `#363636` hover, 6px radius, shadow.

- [ ] **Step 2: Add `[[` doc linking**

Custom suggestion trigger on `[[` that searches documents by title via /api/search and inserts an internal link to `/doc/<id>`.

- [ ] **Step 3: Wire context menu into FilesView**
- [ ] **Step 4: Verify** — right-click doc in sidebar, type `[[` in editor
- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: context menu and [[ doc linking"
```

---

## Task 11: Polish + Final Integration

**Files:**
- Create: `src/lib/text.ts`
- Modify: various

- [ ] **Step 1: Wire all pages through AppShell**

Ensure /, /doc/[id] render inside AppShell. Home renders in content area when no doc open.

- [ ] **Step 2: FTS content sync — src/lib/text.ts**

```typescript
export function extractText(json: any): string {
  if (!json) return "";
  if (json.text) return json.text;
  if (json.content) return json.content.map(extractText).join(" ");
  return "";
}
```

Call `updateFTSContent()` in the PUT /api/documents/[id] route after saving content.

- [ ] **Step 3: Responsive breakpoint**

Add `@media (max-width: 768px)` in globals.css: hide sidebar, reduce padding to 24px 20px, title to 28px.

- [ ] **Step 4: End-to-end test**

1. Login with password
2. Create a collection
3. Create a document in that collection
4. Edit with slash commands, code blocks, callouts
5. Search for the document
6. Share via token URL
7. Open shared link in incognito
8. Verify Ctrl+K, Ctrl+N, Ctrl+\

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: polish, FTS sync, responsive layout, and end-to-end integration"
```
