# Basemark — Design Spec

A minimal, keyboard-first wiki for engineers. Obsidian Baseline aesthetics, Outline-like block editing, agent-ready API. Deploys to Vercel/Cloudflare with zero infrastructure.

## Stack

- **Framework**: Next.js (App Router) with Bun
- **Editor**: Tiptap v2 (ProseMirror-based)
- **Database**: SQLite via Drizzle ORM (better-sqlite3 locally, Turso/D1 deployed)
- **Auth**: Single-user, password from env var
- **Fonts**: Inter (body/headings), Instrument Serif (document titles/H1), JetBrains Mono (code)

## Architecture

```
Browser
├── Sidebar (Files view, Search view)
├── Tab bar
└── Tiptap editor (720px max-width content column)
        │
        ▼  Next.js API Routes
/api/documents    CRUD + full-text search
/api/collections  CRUD
/api/share        Generate/validate share tokens
/api/auth         Password login, session cookie
        │
        ▼  Drizzle ORM
SQLite (single file)
├── documents
├── collections
├── share_links
├── documents_fts (FTS5 virtual table)
└── sessions
```

## Data Model

### documents
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | nanoid |
| title | TEXT NOT NULL | |
| content | TEXT | Tiptap JSON |
| collection_id | TEXT FK | nullable, references collections(id) |
| sort_order | REAL | fractional indexing for reorder |
| created_at | INTEGER | unix ms |
| updated_at | INTEGER | unix ms |

### collections
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | nanoid |
| name | TEXT NOT NULL | |
| icon | TEXT | emoji |
| color | TEXT | hex |
| sort_order | REAL | |
| created_at | INTEGER | |

### share_links
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| document_id | TEXT FK | ON DELETE CASCADE |
| token | TEXT UNIQUE | nanoid, used in URL |
| expires_at | INTEGER | nullable, null = never |
| created_at | INTEGER | |

### documents_fts (FTS5 virtual table)
Indexes `id`, `title`, `content_text` (plain-text extraction). Auto-synced via triggers on the documents table.

### sessions
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| token | TEXT UNIQUE | |
| created_at | INTEGER | |
| expires_at | INTEGER | |

## UI Layout

### Visual design
- **Sidebar**: `#262626`, no borders/dividers
- **Tab bar**: `#262626`, same surface as sidebar — blended
- **Content area**: `#1e1e1e`
- **Active tab**: `#1e1e1e` background, rounded top, inverse rounded corners where tab meets content (concave CSS trick using box-shadow on pseudo-elements)
- **Content top-left**: inverse rounded corner where sidebar meets content area
- **Document title**: Instrument Serif, 400 weight, ~34px
- **Body text**: Inter, 16px, 1.75 line height, 720px max-width centered
- **Code blocks**: JetBrains Mono, `#242424` bg, 8px radius, VS Code dark syntax colors
- **Callouts**: colored left border + tinted background (info/warning/tip/success)
- **Inline code**: `#2a2a2a` bg, orange text `hsl(20, 90%, 68%)`, 4px radius

### Sidebar
- **Panel icon** (sidebar toggle): on the tab row, right next to the first tab, indenting it. Not in the sidebar zone.
- **Fully collapsible**: when collapsed, panel icon stays on tab row, tabs shift left
- **Two views** via tab switcher at sidebar top:
  - **Files**: collection tree with chevron expand/collapse. Active doc has subtle `rgba(255,255,255,0.06)` rounded highlight. Same text size for active/inactive.
  - **Search**: search input + results with title, snippet, highlighted matches in accent color
- **Context menu** (right-click on doc): Rename, Move to..., Share, Delete (red)
- **Uncategorized docs**: shown at bottom, separated by thin divider
- **Settings gear**: bottom-left corner

### Home / Landing page (no doc open)
- "Basemark" in Instrument Serif, centered
- "What's on your mind?" subtitle
- Click-to-write input with `Ctrl+N` hint — clicking creates a new doc
- **Recent docs list**: title, collection name, relative time. Most recent is brighter, older ones fade.

### Responsive
- Below 768px: sidebar hidden, hamburger toggle, full-width editor with reduced padding
- Tab bar remains functional on mobile

## Editor Features (MVP)

### Block types
- Rich text: headings (H1-H6), bold, italic, strikethrough, underline
- Code blocks with language picker and syntax highlighting
- Tables (insert, resize columns, add/remove rows+cols)
- Callouts/notice blocks: info, warning, tip, success
- Checkbox/task lists
- Blockquotes
- Horizontal rules
- Images (upload + paste)

### Slash commands
`/` opens command menu:
- `/code` — code block with language picker
- `/table` — insert table
- `/callout` — callout type picker
- `/todo` — checkbox list
- `/divider` — horizontal rule
- `/link` — link to another doc (autocomplete)

### Keyboard shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Command palette — search docs, run actions |
| `Ctrl+N` | New document |
| `Ctrl+P` | Quick open (fuzzy file switcher) |
| `Ctrl+Shift+F` | Global search (jumps to Search view) |
| `Ctrl+\` | Toggle sidebar |
| `Ctrl+E` | Toggle edit/preview mode |

### Doc linking
- `[[` triggers doc search autocomplete — inserts a link to another doc

## Sharing

- Generate a share link via UI button or context menu
- Share URL format: `/share/[token]`
- Renders the document read-only, no login required
- Styled identically to the editor view (same theme, same typography)
- Optional expiration date

## Auth

- Single-user: password set via `AUTH_PASSWORD` env var
- Login page: password input, sets a session cookie
- API routes protected by middleware checking session cookie or `Authorization: Bearer <token>` header
- API tokens for agent access: generated in settings, stored in sessions table

## Search

- SQLite FTS5 full-text search across document titles and content
- Plain-text extraction from Tiptap JSON stored in FTS virtual table
- Search results show: document title, matching snippet with highlighted terms, collection name
- Triggered via `Ctrl+Shift+F` or sidebar Search view

## Theme System

CSS custom properties on `:root`, trivial to swap for light mode later:

```css
--bg-primary: #1e1e1e;
--bg-sidebar: #262626;
--bg-code: #242424;
--bg-input: #2a2a2a;
--bg-hover: #363636;
--border: #2a2a2a;
--text-primary: #dadada;
--text-secondary: #b3b3b3;
--text-faint: #999999;
--text-dimmed: #666666;
--text-ghost: #555555;
--accent: #0786d5;
--code-text: hsl(20, 90%, 68%);
--font-title: 'Instrument Serif', serif;
--font-body: Inter, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

## Future Features (post-MVP)

### Power user
- Mermaid diagram rendering
- Math (KaTeX) inline and block
- Backlinks panel (see what docs link to this one)
- Templates (Meeting notes, RFC, ADR)
- Export (markdown, PDF)
- Vim keybindings toggle
- Zen mode (hide everything, full-screen editor)

### Agentic
- **REST API**: every UI action available as an API call with bearer token auth
- **MCP server**: expose wiki as MCP tools (`search_docs`, `read_doc`, `create_doc`, `update_doc`, `list_collections`) — any MCP-capable agent can read/write the wiki natively
- **Agent inbox**: special collection that agents can push to — daily summaries, build reports, research dumps. User reviews and archives or moves to proper collections.
- **Agent-authored indicators**: subtle icon on blocks written by agents
- **Webhooks**: fire on doc create/update for downstream agent triggers
- **Template slots**: sections marked as "agent-fillable" for automated research/fill

## Deployment

- **Local**: `bun dev` — SQLite file in project root
- **Vercel**: with Turso (hosted SQLite) for persistence
- **Cloudflare**: with D1 (SQLite at the edge)
- **Docker**: single container, SQLite volume mount
