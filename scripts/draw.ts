// Run once a year: reads data/people.json + data/history.json, generates
// this year's assignments, appends them to history.json, generates one
// static reveal page per person into site/, and emails each person their
// reveal link.
//
//   npm run draw                  # full run: assign, write files, send emails
//   npm run draw -- --dry-run     # do everything except send emails
//   npm run draw -- --year 2027   # override the year (defaults to current)
//
// site/ is not committed to git — a GitHub Actions workflow builds and
// deploys it straight to GitHub Pages (see scripts/build-site.ts and
// .github/workflows/deploy-pages.yml). Push to main after running this.

import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { generateAssignments } from '../lib/assign.ts'
import { loadPeople, loadHistory, flattenHistory } from '../lib/data.ts'
import { generateRevealPages } from '../lib/site.ts'
import { createEmailSender } from '../lib/email.ts'
import type { HistoryEntry, Person } from '../lib/schema.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PEOPLE_PATH = path.join(ROOT, 'data/people.json')
const HISTORY_PATH = path.join(ROOT, 'data/history.json')
const PHOTOS_DIR = path.join(ROOT, 'photos')
const SITE_DIR = path.join(ROOT, 'site')

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (existsSync(path.join(ROOT, '.env'))) {
    process.loadEnvFile(path.join(ROOT, '.env'))
  }

  const people = await loadPeople(PEOPLE_PATH)
  const history = await loadHistory(HISTORY_PATH)

  const currentYear = args.year ?? new Date().getFullYear()
  const yearKey = String(currentYear)

  if (history[yearKey]) {
    throw new Error(
      `history.json already has an entry for ${yearKey}. Refusing to overwrite — ` +
        `history is append-only. Delete that entry manually first if you really mean to redraw.`
    )
  }

  console.log(`Drawing Secret Santa for ${currentYear} (${people.length} people)...`)

  const pastAssignments = flattenHistory(history)
  const assignments = generateAssignments({ people, pastAssignments, currentYear })

  const historyEntries: HistoryEntry[] = assignments.map((a) => ({
    ...a,
    revealToken: randomUUID(),
  }))

  // Write history.json first — this is the source of truth. If email
  // sending fails partway through, the draw itself is not lost.
  history[yearKey] = historyEntries
  await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n')
  console.log(`Wrote ${historyEntries.length} assignments to data/history.json.`)

  await generateRevealPages({ people, entries: historyEntries, photosDir: PHOTOS_DIR, siteDir: SITE_DIR })
  console.log(`Generated ${historyEntries.length} reveal pages in site/.`)
  console.log('Commit + push data/history.json to trigger the Pages deploy (see README).')

  if (args.dryRun) {
    console.log('--dry-run: skipping email sending.')
    return
  }

  await sendEmails(people, historyEntries)
}

function parseArgs(argv: string[]): { dryRun: boolean; year?: number } {
  const dryRun = argv.includes('--dry-run')
  const yearFlagIndex = argv.indexOf('--year')
  const year = yearFlagIndex !== -1 ? Number(argv[yearFlagIndex + 1]) : undefined
  if (year !== undefined && !Number.isInteger(year)) {
    throw new Error(`--year must be an integer, got: ${argv[yearFlagIndex + 1]}`)
  }
  return { dryRun, year }
}

async function sendEmails(people: Person[], entries: HistoryEntry[]) {
  const gmailUser = process.env.GMAIL_USER
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD
  const siteBaseUrl = process.env.SITE_BASE_URL

  if (!gmailUser || !gmailAppPassword || !siteBaseUrl) {
    throw new Error(
      'Missing GMAIL_USER, GMAIL_APP_PASSWORD, or SITE_BASE_URL. Set them in .env (see .env.example), ' +
        'or run with --dry-run to skip emailing.'
    )
  }

  const sendRevealEmail = createEmailSender({ gmailUser, gmailAppPassword })
  const byId = new Map(people.map((p) => [p.id, p]))
  let sent = 0

  for (const entry of entries) {
    const giver = byId.get(entry.giverId)!
    const revealUrl = `${siteBaseUrl}/reveal-${entry.revealToken}.html`
    await sendRevealEmail({
      toEmail: giver.email,
      toName: giver.name,
      revealUrl,
    })
    sent++
    console.log(`Emailed ${giver.name} <${giver.email}>`)
  }

  console.log(`Sent ${sent} emails.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
