# Secret Santa

A small, private tool for running the family Secret Santa draw once a
year. No server, no database — flat JSON files + a local script +
static HTML. See [CLAUDE.md](./CLAUDE.md) for the full design rationale
and constraints.

## Setup

```bash
npm install
cp .env.example .env   # then fill in RESEND_API_KEY, FROM_EMAIL, SITE_BASE_URL
```

1. Edit `data/people.json` — one entry per person (name, email,
   `householdId`, `wishlistUrl`, `photoFile`). The `photoFile` must match
   a file you add under `photos/`.
2. Add each person's photo to `photos/<photoFile>` (see
   `photos/README.md`).
3. Fill in `.env`:
   - `RESEND_API_KEY` — from https://resend.com/api-keys
   - `FROM_EMAIL` — a sender verified in your Resend account
   - `SITE_BASE_URL` — where you'll deploy `site/` (see below), used to
     build each person's reveal link

## Running the draw

```bash
npm run draw              # assign, write history.json, generate site/, send emails
npm run draw -- --dry-run # same, but skip sending emails
```

This is append-only: it refuses to run again for a year that's already
in `data/history.json`. If you need to redraw a year, delete that year's
entry from `history.json` first.

## Deploying reveal pages

`npm run draw` generates static files into `site/` (gitignored — it's
build output, not source of truth). Deploy that folder's contents to any
static host — GitHub Pages, Netlify, Vercel static, etc. — matching the
`SITE_BASE_URL` you set in `.env`. This is a separate, manual step.

## Sanity-checking the assignment logic

```bash
npm run test:assign  # runs generateAssignments hundreds of times across
                      # varied household shapes, asserts constraints hold
npm run typecheck
```

## Project structure

```
data/
  people.json    # hand-edited: names, households, wishlist links, photo filenames
  history.json   # append-only draw history, one entry per year
photos/          # one photo per person, committed to the repo
lib/
  assign.ts      # assignment algorithm (no self / no household / no last-year-repeat)
  schema.ts      # zod validation for the JSON data files
  reveal.ts      # generates the static blur-to-sharp reveal page
  email.ts       # sends each person their reveal link via Resend
scripts/
  draw.ts        # the once-a-year entry point
  test-assign.ts # sanity check for assign.ts
site/            # generated output — deploy this, don't hand-edit it
```
