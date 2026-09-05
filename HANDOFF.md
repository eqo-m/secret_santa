# Hand-off — 2026-09-05

Status: pipeline is built and verified end-to-end. What's left before a
real draw is just filling in real family data.

## What's done and verified

- **Assignment logic** (`lib/assign.ts`, unchanged from spec) — sanity-tested
  via `npm run test:assign`: 1200 runs across 7 household shapes, all three
  constraints (no self / no household / no last-year-repeat) held.
- **Reveal pages** (`lib/reveal.ts`) — blur-to-sharp static HTML, confirmed
  live and rendering correctly at the real GitHub Pages URL.
- **Email** (`lib/email.ts`) — switched from Resend to Nodemailer + Gmail
  app password. Confirmed real delivery (11/11 test emails arrived).
- **GitHub Pages deploy** — `.github/workflows/deploy-pages.yml` rebuilds
  `site/` via `scripts/build-site.ts` (idempotent, no side effects — safe
  to re-run, never sends email or touches history.json) and publishes it
  as a Pages deployment artifact on every push to `main`. `site/` itself
  is gitignored, never committed.
- **Email privacy split** — `data/people.json` (committed, public repo)
  has no `email` field at all. Real emails live in `data/emails.json`
  (gitignored, local-only, never committed), read only by
  `scripts/draw.ts`'s send step — the CI build path never touches it.
  Verified nothing named "email" appears in the file GitHub actually
  serves.
- Repo is live: `github.com/eqo-m/secret_santa` (public).
  `SITE_BASE_URL` in `.env` is set to the real Pages URL (no trailing
  slash).

## Deliberate tradeoffs, decided with you

- Repo is **public**. `data/history.json` (names, household IDs, wishlist
  links, and reveal tokens) is therefore technically world-readable — you
  explicitly accepted this as low-risk ("nobody in the family is going to
  dig through GitHub"). Email was the one field you wanted held back, and
  that's the only thing actually kept private.
- No GitHub Pro / private repo needed — the CI-artifact deploy approach
  gets the same practical outcome (generated HTML never sits in git) for
  free.

## Before running a real draw — TODO

1. **Photos**: replace the shared placeholder `photos/A.jpg` (a test
   image, not anyone's real photo) with one real photo per person, and
   update each person's `photoFile` in `data/people.json` to point at
   their own file. See `photos/README.md`.
2. **Emails**: `data/emails.json` doesn't exist in a fresh clone (it's
   gitignored). Copy `data/emails.example.json` → `data/emails.json` and
   fill in real addresses per person id.
3. **Clear the test draw**: `data/history.json` currently has a `"2026"`
   entry from the dry run (giver→receiver assignments built from the
   placeholder photo/test emails). `npm run draw` refuses to run again
   for a year already in history — delete that `"2026"` entry (reset the
   file to `{}`, or just remove that key) before drawing for real.
4. **People data**: `data/people.json` names/households/wishlist URLs are
   still the original placeholder people (alice/bob/carol/...) — swap in
   the real 11 people / 5 households.

## Running it for real

```bash
npm run draw              # assign, write history.json, generate site/, send emails
npm run draw -- --dry-run # same, but skip sending emails — good for one more check
git add data/people.json data/history.json
git commit -m "2026 draw"
git push                  # triggers the Pages workflow, redeploys site/
```

(`site/` and `data/emails.json` are gitignored — nothing to add there.)

## Useful commands

```bash
npm run test:assign  # sanity-check assign.ts across household shapes
npm run typecheck
npm run build:site    # rebuild site/ locally without doing a new draw
```

## Where things live

- Repo: https://github.com/eqo-m/secret_santa
- Live Pages site base: value of `SITE_BASE_URL` in `.env`
- Full design rationale / constraints: `CLAUDE.md`
- Setup/usage instructions: `README.md`
