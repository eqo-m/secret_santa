# Secret Santa — Project Context

A small, private family tool for running an annual Secret Santa draw.
Built for ~11 people / 5 households. No public users, no auth system —
access is via unguessable per-person magic links. Runs once a year, so
the whole project is intentionally minimal — no database, no server to
maintain, no admin UI. A local script + static files is the target.

## Stack

- **Runtime:** Node.js + TypeScript, run locally/once a year via a script
- **Persistence:** flat JSON files, committed to the repo — this *is*
  the "database" and doubles as the history log
- **Email:** Nodemailer via Gmail (app password), called directly from
  the script
- **Reveal pages:** static HTML, generated at draw time, deployed to any
  static host (GitHub Pages, Netlify, Vercel static — free tier, no
  server code running)
- **No Next.js, no Supabase, no Vercel functions, no Firebase, no
  Django** — deliberately avoiding any persistent backend or hosted DB
  for something that runs once a year. Don't reintroduce this
  infrastructure without asking.

## Core rules / constraints (do not relax without asking)

Assignment logic (`lib/assign.ts`, already written — treat as reference,
feel free to refactor but preserve behavior):

1. Nobody can be assigned themselves.
2. Nobody can be assigned someone from their own household
   (`householdId` match) — **hard constraint, must never be violated.**
3. Nobody can be assigned the same person they had *last year*
   (single-year cooldown only, not multi-year) — hard constraint, but
   if genuinely impossible given household sizes, throw a clear error
   rather than silently violating the household rule.
4. No wishlist feature to build — wishlists live in an external service
   already. We only store a `wishlistUrl` per person and link to it.

Assignment uses randomized backtracking (see existing `assign.ts`), not
naive shuffle-and-retry — small people counts make naive approaches prone
to dead ends given household constraints.

## Data model (JSON files, not a DB)

`data/people.json`:
```json
[
  {
    "id": "alice",
    "name": "Alice",
    "email": "alice@example.com",
    "householdId": "household-1",
    "wishlistUrl": "https://..."
  }
]
```
IDs can be simple slugs (`alice`, not a UUID) since this is hand-edited,
not machine-generated.

`data/history.json` — one entry per year, appended to on every draw, never
overwritten:
```json
{
  "2025": [
    { "giverId": "alice", "receiverId": "bob", "revealToken": "..." }
  ],
  "2026": [
    { "giverId": "alice", "receiverId": "carol", "revealToken": "..." }
  ]
}
```
`revealToken` should be a random unguessable string (e.g. `crypto.randomUUID()`),
used only to build the reveal page filename/URL — no auth beyond obscurity,
which is fine for this use case.

## Project structure

```
secret-santa/
├── data/
│   ├── people.json          # hand-edited: names, households, wishlist links
│   └── history.json         # append-only, one entry per year, written by draw.ts
├── scripts/
│   ├── draw.ts              # run once/year: generates assignments, updates
│   │                         # history.json, builds static reveal pages, sends emails
│   └── build-site.ts        # rebuilds site/ from data/ only — no draw, no
│                             # email, safe to re-run (used by CI)
├── lib/
│   ├── assign.ts            # unchanged from before
│   ├── site.ts              # shared reveal-page generation (draw.ts + build-site.ts)
│   └── email.ts             # sends each person their reveal link via Gmail (nodemailer)
├── site/
│   └── reveal-{token}.html  # generated output, one static file per person
├── .github/workflows/
│   └── deploy-pages.yml     # rebuilds site/ and deploys to GitHub Pages on push
├── .env                     # GMAIL_USER + GMAIL_APP_PASSWORD only
└── package.json
```

Everything happens in one command (`npm run draw` or similar): read
`people.json` + `history.json` → run `generateAssignments` → append the
result to `history.json` → generate one static HTML file per person into
`site/` → email each person their `reveal-{token}.html` link → done.

`site/` is gitignored, not committed — its filenames carry the
unguessable reveal tokens, and this repo is public, so committing them
would make every reveal link discoverable in the repo's file tree.
Deploying is instead a GitHub Actions workflow
(`.github/workflows/deploy-pages.yml`) that rebuilds `site/` from
`data/` on every push and publishes it straight to GitHub Pages as a
deployment artifact — the HTML never touches git history. Triggering
that deploy still requires a manual `git push` after running the draw;
only the actual publish step is automated.

## Reveal page UX

Each `site/reveal-{token}.html` is a fully static, standalone page — no
server, no API calls, no per-visit state. Keep it dead simple: one
screen, one interaction, works for non-technical family members.

**Blur-to-sharp reveal effect, every visit (no "first visit only" tracking):**
- Page loads with the assignee's photo rendered at a heavy CSS blur
  (`filter: blur(20px)`).
- On page load (or on click/tap, whichever feels more natural — try
  on-load with a short delay), transition to `blur(0)` over ~800ms,
  ease-out.
- No attempt to track whether this is a repeat visit — replaying the
  animation on a second visit is a non-issue for this use case, and
  avoiding that logic means no `localStorage`, no server round-trip, no
  DB flag. Keep this genuinely stateless.
- Below the image: assignee's name + a link/button to their `wishlistUrl`.

## Existing assignment algorithm (lib/assign.ts)

```ts
type Person = { id: string; name: string; householdId: string }
type PastAssignment = { year: number; giverId: string; receiverId: string }
type Assignment = { giverId: string; receiverId: string }

export function generateAssignments({
  people,
  pastAssignments,
  currentYear,
}: {
  people: Person[]
  pastAssignments: PastAssignment[]
  currentYear: number
}): Assignment[] {
  const forbidden = new Map<string, Set<string>>()

  for (const giver of people) {
    const excluded = new Set<string>([giver.id]) // no self
    for (const other of people) {
      if (other.householdId === giver.householdId) excluded.add(other.id) // no household
    }
    const lastYear = pastAssignments.find(
      (p) => p.giverId === giver.id && p.year === currentYear - 1
    )
    if (lastYear) excluded.add(lastYear.receiverId) // no repeat of last year only
    forbidden.set(giver.id, excluded)
  }

  for (const giver of people) {
    if (people.length - forbidden.get(giver.id)!.size <= 0) {
      throw new Error(`No valid recipients for ${giver.name}.`)
    }
  }

  for (let attempt = 0; attempt < 500; attempt++) {
    const result = tryBacktrack(people, forbidden)
    if (result) return result
  }
  throw new Error('Could not find a valid assignment.')
}

function tryBacktrack(
  people: Person[],
  forbidden: Map<string, Set<string>>
): Assignment[] | null {
  const givers = shuffle([...people])
  const availableReceivers = new Set(people.map((p) => p.id))
  const assignments: Assignment[] = []

  function backtrack(index: number): boolean {
    if (index === givers.length) return true
    const giver = givers[index]
    const candidates = shuffle(
      [...availableReceivers].filter((id) => !forbidden.get(giver.id)!.has(id))
    )
    for (const receiverId of candidates) {
      availableReceivers.delete(receiverId)
      assignments.push({ giverId: giver.id, receiverId })
      if (backtrack(index + 1)) return true
      assignments.pop()
      availableReceivers.add(receiverId)
    }
    return false
  }

  return backtrack(0) ? assignments : null
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

## Dev environment notes

- Working on Linux — Claude Desktop's Linux beta covers Debian/Ubuntu
  officially; if on another distro, the CLI (`claude` command) works
  identically and is the fallback.
- Keep dependencies minimal: this should need little beyond `nodemailer`
  and TypeScript tooling — no framework, no DB client, no ORM. Push back
  (ask first) if a dependency starts pulling in a server or DB.
- Commit incrementally: scaffold → assign logic → draw script → reveal
  page generation → email sending → polish. Don't squash into one commit.
- After wiring up `assign.ts`, write a quick script/test that runs
  `generateAssignments` many times over varied household sizes and
  asserts constraints hold (no self, no household, no last-year repeat)
  — this is a good sanity check before trusting it with real data.
- `.env` will need `GMAIL_USER` and `GMAIL_APP_PASSWORD` (a 16-character
  Gmail app password, not the account login password — requires 2FA,
  generated at https://myaccount.google.com/apppasswords). Don't invent
  a placeholder that looks like a real one — use an obvious placeholder
  and tell the user where to get a real one.
- `data/people.json` and `data/history.json` should be treated as the
  source of truth — no migrations, no schema versioning needed, just
  keep the shape consistent and validate it lightly (e.g. with zod) if
  it's cheap to do so.
