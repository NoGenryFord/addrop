# Snaprime — Agent Instructions

> Read this file before touching any code. It is the single source of truth for architecture, conventions, and current state.

## What This App Does

Paste a website URL → get a structured brand profile + 1–3 ready-to-edit ad creatives. The full loop:

1. User submits a URL
2. Server fetches the page (with JS-rendering fallback via Firecrawl)
3. AI extracts a structured brand profile (facts only, no hallucinations)
4. AI generates 1–3 ad creatives grounded in that profile
5. User edits any field, swaps images, or regenerates a single ad — all persisted

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (SSR, file-based routing, server handlers) |
| Runtime | Cloudflare Workers (via `wrangler`) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | Neon (serverless PostgreSQL) |
| ORM | Drizzle ORM + drizzle-kit |
| AI | `@tanstack/ai` — Anthropic by default, multi-vendor fallback |
| State | TanStack Query (server state), TanStack Store (local UI state) |
| Routing | TanStack Router (file-based, type-safe) |
| Web scraping | Plain fetch → Firecrawl API fallback |
| Validation | Zod |
| Deploy | GitHub Actions → `wrangler deploy` on push to `main` |

## Repository Layout

```
addrop/
├── src/
│   ├── routes/                  # File-based routes (TanStack Router)
│   │   ├── __root.tsx           # HTML shell, meta, CSS import
│   │   ├── index.tsx            # Landing page — URL input form
│   │   ├── campaigns/
│   │   │   └── $campaignId.tsx  # Campaign page: brand profile + ads
│   │   └── api/                 # Server-only handlers (no UI)
│   │       ├── campaigns.ts     # POST /api/campaigns
│   │       ├── campaigns.$campaignId.ts  # GET /api/campaigns/:id
│   │       ├── ads.$adId.ts     # PUT /api/ads/:id (partial update)
│   │       └── ads.$adId.regenerate.ts  # POST /api/ads/:id/regenerate
│   ├── components/
│   │   ├── ui/                  # Reusable primitives (Button, Input, Card…)
│   │   ├── BrandProfileCard.tsx # Displays extracted brand profile
│   │   ├── AdCard.tsx           # Editable ad preview + regenerate
│   │   ├── ImagePicker.tsx      # Swap image from candidates
│   │   ├── StatusProgress.tsx   # Animated pipeline status banner
│   │   └── ThemeToggle.tsx      # (existing) dark/light toggle
│   ├── lib/
│   │   ├── scraper.ts           # fetchPageContent(): fetch + Firecrawl fallback
│   │   ├── extractor.ts         # extractBrandProfile(): AI structured output
│   │   └── adGenerator.ts      # generateAds() / generateOneAd()
│   ├── db/
│   │   ├── schema.ts            # Drizzle table definitions (source of truth)
│   │   └── index.ts             # getDb() — Neon HTTP client
│   ├── hooks/
│   │   └── useCampaign.ts       # TanStack Query hook with polling
│   ├── types/
│   │   └── index.ts             # Shared TypeScript types (Campaign, Ad, BrandProfile)
│   ├── router.tsx               # Router factory with QueryClient context
│   ├── routeTree.gen.ts         # AUTO-GENERATED — never edit manually
│   └── styles.css               # Tailwind + CSS custom properties
├── drizzle/                     # SQL migration files (commit these)
├── .github/workflows/deploy.yml # CI: generate-routes → build → wrangler deploy
├── wrangler.jsonc               # Cloudflare Workers config
├── drizzle.config.ts            # Drizzle ORM config
└── AGENTS.md                    # This file
```

## Database Schema

Three tables. All relations are campaign-centric.

```
campaigns          brand_profiles          ads
─────────────      ──────────────────      ────────────────
id                 id                      id
url                campaignId → campaigns  campaignId → campaigns
status*            businessDescription     creativeIdea
errorMessage       targetAudience          primaryText   (≤125 chars)
createdAt          valueProposition        headline      (≤40 chars)
updatedAt          brandTone               description   (≤30 chars)
                   colorPalette (jsonb)    cta
                   candidateImages (jsonb) selectedImage
                   createdAt              status*
                                          createdAt / updatedAt
```

`status` values:
- campaigns: `pending → extracting → generating → ready | failed`
- ads: `ready | regenerating`

**Always use `getDb()` from `src/db/index.ts`.** Never import `drizzle-orm/node-postgres` — it breaks on Cloudflare Workers.

## API Contract

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/campaigns` | `{ url: string }` | `{ id: number }` |
| GET | `/api/campaigns/:id` | — | `{ campaign, brandProfile, ads }` |
| PUT | `/api/ads/:id` | `{ field: string, value: string }` | `{ ok: true }` |
| POST | `/api/ads/:id/regenerate` | — | `{ ok: true }` |

POST `/api/campaigns` returns immediately with `{ id }`. The pipeline (extract → generate) runs synchronously inside the same request using Cloudflare's CPU budget. Frontend polls `GET /api/campaigns/:id` every 2s until `status === 'ready'`.

## Writing a Server Handler

API routes live in `src/routes/api/`. They export a `Route` with `server.handlers`:

```typescript
// src/routes/api/campaigns.ts
import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '#/db'
import { campaigns } from '#/db/schema'

export const Route = createFileRoute('/api/campaigns')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { url } = await request.json()
        const db = getDb()
        const [campaign] = await db.insert(campaigns).values({ url }).returning()
        return Response.json({ id: campaign.id })
      },
    },
  },
})
```

No top-level `db` instance — always call `getDb()` inside the handler (Cloudflare Workers are stateless per-request).

## Writing a Page Route

```typescript
// src/routes/campaigns/$campaignId.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/campaigns/$campaignId')({
  component: CampaignPage,
})

function CampaignPage() {
  const { campaignId } = Route.useParams()
  // use TanStack Query for data fetching + polling
}
```

After adding any new route file, run:
```bash
npm run generate-routes
```
`routeTree.gen.ts` is auto-generated — **never edit it manually**.

## AI Layer Conventions

- Use structured output (Zod schema) for all AI calls — never parse free-form text
- System prompts must include: "Only use facts present in the provided content. If not found, say 'not found'."
- Default model: `claude-haiku-4-5` (fast + cheap for extraction). Use stronger model only for ad generation if quality is poor.
- Log `inputTokens + outputTokens` for every AI call
- Hard cap: truncate input content to 8,000 characters before sending to AI

## Scraper Layer Conventions

`fetchPageContent(url)` in `src/lib/scraper.ts`:
1. Plain `fetch()` with browser-like User-Agent
2. If `text.length < 500` → JS-rendered page → call Firecrawl API
3. If Firecrawl unavailable → return partial result with `sourceMethod: 'fallback'`
4. Always return `ScrapedContent` — never throw unless URL is completely unreachable

## Environment Variables

| Variable | Used in | Required |
|---|---|---|
| `DATABASE_URL` | `src/db/index.ts` | Yes |
| `ANTHROPIC_API_KEY` | `src/lib/extractor.ts`, `src/lib/adGenerator.ts` | Yes (or OPENAI) |
| `FIRECRAWL_API_KEY` | `src/lib/scraper.ts` | Recommended |
| `OPENAI_API_KEY` | AI fallback | Optional |

Local: add to `.env.local` (gitignored).
Production: GitHub Secrets → passed via `deploy.yml` env block → available in Worker.

## Development Workflow

```bash
npm run dev          # local dev server on :3000 (auto-generates routes)
npm run generate-routes  # manual route tree regeneration
npm run db:generate  # generate SQL migration after schema change
npm run db:migrate   # apply migrations to Neon
npm run db:studio    # Drizzle Studio GUI
npm run build        # production build
npm run deploy       # build + wrangler deploy (needs CLOUDFLARE_API_TOKEN)
```

**Branch strategy:** develop on `dev`, merge to `main` → auto-deploys to Cloudflare.

## Implementation Status

### Done ✅
- Project scaffold (TanStack Start + Cloudflare Workers)
- CI/CD pipeline (GitHub Actions → Cloudflare Workers)
- Database schema (`campaigns`, `brand_profiles`, `ads`)
- Initial migration generated (`drizzle/0000_condemned_titania.sql`)
- Root route (`__root.tsx`) with HTML shell
- DB connection via Neon HTTP driver (`src/db/index.ts`)

### In Progress / Next
- [ ] `src/routes/index.tsx` — URL input landing page
- [ ] `src/lib/scraper.ts` — fetch + Firecrawl fallback
- [ ] `src/lib/extractor.ts` — AI brand profile extraction
- [ ] `src/lib/adGenerator.ts` — AI ad generation
- [ ] `src/routes/api/campaigns.ts` — POST handler
- [ ] `src/routes/api/campaigns.$campaignId.ts` — GET handler (polling)
- [ ] `src/routes/api/ads.$adId.ts` — PUT handler (edit field)
- [ ] `src/routes/api/ads.$adId.regenerate.ts` — POST handler (regenerate)
- [ ] `src/routes/campaigns/$campaignId.tsx` — campaign page UI
- [ ] `src/components/AdCard.tsx` — editable ad preview
- [ ] `src/components/BrandProfileCard.tsx` — brand profile display
- [ ] `src/components/StatusProgress.tsx` — pipeline status banner

### Consciously Deferred
- Image file upload (use URL-swap from candidate images instead)
- SSRF protection beyond basic URL validation
- Caching extracted content (Redis/KV)
- Precise CSS color extraction (use AI-inferred colors)
- Campaign list / history page
- Auth / user accounts

## Key Design Decisions

**Why polling instead of WebSocket?** Cloudflare Workers are stateless — WebSocket would require Durable Objects. Polling every 2s is simpler and sufficient for this flow.

**Why synchronous pipeline?** For MVP, the extract+generate pipeline runs inside the POST request. This keeps the code simple. If it hits Cloudflare's CPU limit, the fix is to split into two requests (create → extract → redirect → generate on page load).

**Why Firecrawl over Cloudflare Browser Rendering?** Firecrawl has a free tier, a simple REST API, and no infra to manage. Cloudflare Browser Rendering requires a paid plan and more setup.

**Why partial UPDATE for ads?** Prevents race conditions between inline edits and regeneration. Each field is updated independently — a `regenerate` response won't overwrite a field the user just edited.
