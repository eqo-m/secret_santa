# Secret Santa

A small, private tool for running the family Secret Santa draw once a
year. No server, no database — flat JSON files + a local script +
static HTML. See [CLAUDE.md](./CLAUDE.md) for the full design rationale
and constraints.

## Setup

```bash
npm install
cp .env.example .env   # then fill in GMAIL_USER, GMAIL_APP_PASSWORD, SITE_BASE_URL
```

1. Edit `data/people.json` — one entry per person (name, email,
   `householdId`, `wishlistUrl`, `photoFile`). The `photoFile` must match
   a file you add under `photos/`.
2. Add each person's photo to `photos/<photoFile>` (see
   `photos/README.md`).
3. Fill in `.env`:
   - `GMAIL_USER` — the Gmail address to send from
   - `GMAIL_APP_PASSWORD` — a 16-character app password (requires 2FA on
     the account), generated at https://myaccount.google.com/apppasswords
     — not your regular Gmail login password
   - `SITE_BASE_URL` — your GitHub Pages URL (see below), used to build
     each person's reveal link. For a repo named `secret-santa` under
     account `you`, that's `https://you.github.io/secret-santa` — no
     trailing slash.

## Running the draw

```bash
npm run draw              # assign, write history.json, generate site/, send emails
npm run draw -- --dry-run # same, but skip sending emails
```

This is append-only: it refuses to run again for a year that's already
in `data/history.json`. If you need to redraw a year, delete that year's
entry from `history.json` first.

## Deploying reveal pages (GitHub Pages)

`site/` is gitignored — it's build output, not source of truth, and its
filenames contain the unguessable reveal tokens, so we never want it
sitting in the repo's git history (that repo is public; committing the
tokens would make every reveal link discoverable by anyone browsing the
repo). Instead, `.github/workflows/deploy-pages.yml` rebuilds `site/`
straight from `data/people.json` + `data/history.json` and publishes it
as a Pages *deployment artifact* — the HTML never touches git.

One-time setup:
1. Push this repo to GitHub (keep it public — Pages on GitHub Free
   requires a public repo unless you're on GitHub Pro or higher).
2. In the repo's **Settings → Pages**, set **Source** to **GitHub
   Actions**.
3. Set `SITE_BASE_URL` in `.env` to the resulting Pages URL.

After that, every `git push` to `main` (e.g. after running `npm run
draw`, which updates `data/history.json`) triggers the workflow and
redeploys `site/` automatically. You can also trigger it manually from
the Actions tab (`workflow_dispatch`). Rebuilding is a pure function of
`data/` + `photos/` — running it repeatedly is always safe.

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
  email.ts       # sends each person their reveal link via Gmail (nodemailer)
  data.ts        # load/parse data/*.json, shared by draw.ts and build-site.ts
  site.ts        # regenerates site/ from people + history (no side effects)
scripts/
  draw.ts        # the once-a-year entry point: assign, write history, email
  build-site.ts  # idempotent site/ rebuild — used by CI, no new draw/email
  test-assign.ts # sanity check for assign.ts
.github/workflows/
  deploy-pages.yml # rebuilds site/ and deploys it to GitHub Pages on push
site/            # generated output, gitignored — never committed (see below)
```
