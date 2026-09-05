// Regenerates site/ from data/people.json + data/history.json, with no
// side effects — no new draw, no history.json writes, no email. Safe to
// run any number of times, including in CI. Used by
// .github/workflows/deploy-pages.yml to publish to GitHub Pages without
// ever committing the generated (token-bearing) HTML files to git.
//
//   npm run build:site                # rebuilds the most recent year in history.json
//   npm run build:site -- --year 2026 # rebuilds a specific year

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadPeople, loadHistory, latestYear } from '../lib/data.ts'
import { generateRevealPages } from '../lib/site.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PEOPLE_PATH = path.join(ROOT, 'data/people.json')
const HISTORY_PATH = path.join(ROOT, 'data/history.json')
const PHOTOS_DIR = path.join(ROOT, 'photos')
const SITE_DIR = path.join(ROOT, 'site')

async function main() {
  const yearFlagIndex = process.argv.indexOf('--year')
  const yearArg = yearFlagIndex !== -1 ? Number(process.argv[yearFlagIndex + 1]) : undefined
  if (yearArg !== undefined && !Number.isInteger(yearArg)) {
    throw new Error(`--year must be an integer, got: ${process.argv[yearFlagIndex + 1]}`)
  }

  const people = await loadPeople(PEOPLE_PATH)
  const history = await loadHistory(HISTORY_PATH)

  const year = yearArg ?? latestYear(history)
  if (year === undefined) {
    throw new Error('data/history.json has no draws yet — run `npm run draw` first.')
  }

  const entries = history[String(year)]
  if (!entries) {
    throw new Error(`data/history.json has no entry for ${year}.`)
  }

  await generateRevealPages({ people, entries, photosDir: PHOTOS_DIR, siteDir: SITE_DIR })
  console.log(`Rebuilt ${entries.length} reveal pages for ${year} in site/.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
