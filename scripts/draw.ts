// Run once a year: reads data/people.json + data/history.json, generates
// this year's assignments, appends them to history.json, generates one
// static reveal page per person into site/, and emails each person their
// reveal link.
//
//   npm run draw                  # full run: assign, write files, send emails
//   npm run draw -- --dry-run     # do everything except send emails
//   npm run draw -- --year 2027   # override the year (defaults to current)
//
// Deploying site/ to static hosting is a separate, manual step.

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { generateAssignments, type PastAssignment } from '../lib/assign.ts'
import { PeopleFileSchema, HistoryFileSchema, type Person, type HistoryEntry } from '../lib/schema.ts'
import { generateRevealHtml } from '../lib/reveal.ts'
import { sendRevealEmail } from '../lib/email.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PEOPLE_PATH = path.join(ROOT, 'data/people.json')
const HISTORY_PATH = path.join(ROOT, 'data/history.json')
const PHOTOS_DIR = path.join(ROOT, 'photos')
const SITE_DIR = path.join(ROOT, 'site')
const SITE_PHOTOS_DIR = path.join(SITE_DIR, 'photos')

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (existsSync(path.join(ROOT, '.env'))) {
    process.loadEnvFile(path.join(ROOT, '.env'))
  }

  const people = await loadPeople()
  const history = await loadHistory()

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

  await generateRevealPages(people, historyEntries)
  console.log(`Generated ${historyEntries.length} reveal pages in site/.`)

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

async function loadPeople(): Promise<Person[]> {
  const raw = JSON.parse(await readFile(PEOPLE_PATH, 'utf-8'))
  const result = PeopleFileSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`data/people.json is invalid:\n${result.error.message}`)
  }
  if (result.data.length === 0) {
    throw new Error('data/people.json has no people.')
  }
  return result.data
}

async function loadHistory() {
  const raw = JSON.parse(await readFile(HISTORY_PATH, 'utf-8'))
  const result = HistoryFileSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`data/history.json is invalid:\n${result.error.message}`)
  }
  return result.data
}

function flattenHistory(history: Record<string, HistoryEntry[]>): PastAssignment[] {
  const flat: PastAssignment[] = []
  for (const [yearKey, entries] of Object.entries(history)) {
    for (const entry of entries) {
      flat.push({ year: Number(yearKey), giverId: entry.giverId, receiverId: entry.receiverId })
    }
  }
  return flat
}

async function generateRevealPages(people: Person[], entries: HistoryEntry[]) {
  const byId = new Map(people.map((p) => [p.id, p]))
  await mkdir(SITE_DIR, { recursive: true })
  await mkdir(SITE_PHOTOS_DIR, { recursive: true })

  for (const entry of entries) {
    const giver = byId.get(entry.giverId)
    const receiver = byId.get(entry.receiverId)
    if (!giver || !receiver) {
      throw new Error(`Assignment references unknown person: ${entry.giverId} -> ${entry.receiverId}`)
    }

    const srcPhoto = path.join(PHOTOS_DIR, receiver.photoFile)
    if (!existsSync(srcPhoto)) {
      throw new Error(
        `Missing photo for ${receiver.name}: expected photos/${receiver.photoFile}. ` +
          `Add it before running the draw (see photos/README.md).`
      )
    }
    await copyFile(srcPhoto, path.join(SITE_PHOTOS_DIR, receiver.photoFile))

    const html = generateRevealHtml({
      giverName: giver.name,
      receiverName: receiver.name,
      receiverPhotoPath: `photos/${receiver.photoFile}`,
      receiverWishlistUrl: receiver.wishlistUrl,
    })
    await writeFile(path.join(SITE_DIR, `reveal-${entry.revealToken}.html`), html)
  }
}

async function sendEmails(people: Person[], entries: HistoryEntry[]) {
  const apiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.FROM_EMAIL
  const siteBaseUrl = process.env.SITE_BASE_URL

  if (!apiKey || !fromAddress || !siteBaseUrl) {
    throw new Error(
      'Missing RESEND_API_KEY, FROM_EMAIL, or SITE_BASE_URL. Set them in .env (see .env.example), ' +
        'or run with --dry-run to skip emailing.'
    )
  }

  const byId = new Map(people.map((p) => [p.id, p]))
  let sent = 0

  for (const entry of entries) {
    const giver = byId.get(entry.giverId)!
    const revealUrl = `${siteBaseUrl}/reveal-${entry.revealToken}.html`
    await sendRevealEmail({
      apiKey,
      fromAddress,
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
