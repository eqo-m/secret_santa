// Shared load/parse helpers for the JSON "database" files — used by both
// scripts/draw.ts (full draw + email) and scripts/build-site.ts (rebuild
// reveal pages from existing history, no new draw).

import { readFile } from 'node:fs/promises'

import { existsSync } from 'node:fs'

import {
  PeopleFileSchema,
  HistoryFileSchema,
  EmailsFileSchema,
  type Person,
  type HistoryEntry,
  type HistoryFile,
  type EmailsFile,
} from './schema.ts'
import type { PastAssignment } from './assign.ts'

export async function loadPeople(peoplePath: string): Promise<Person[]> {
  const raw = JSON.parse(await readFile(peoplePath, 'utf-8'))
  const result = PeopleFileSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`${peoplePath} is invalid:\n${result.error.message}`)
  }
  if (result.data.length === 0) {
    throw new Error(`${peoplePath} has no people.`)
  }
  return result.data
}

export async function loadHistory(historyPath: string): Promise<HistoryFile> {
  const raw = JSON.parse(await readFile(historyPath, 'utf-8'))
  const result = HistoryFileSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`${historyPath} is invalid:\n${result.error.message}`)
  }
  return result.data
}

export function flattenHistory(history: HistoryFile): PastAssignment[] {
  const flat: PastAssignment[] = []
  for (const [yearKey, entries] of Object.entries(history)) {
    for (const entry of entries) {
      flat.push({ year: Number(yearKey), giverId: entry.giverId, receiverId: entry.receiverId })
    }
  }
  return flat
}

/** Most recent year present in history.json, or undefined if it's empty. */
export function latestYear(history: HistoryFile): number | undefined {
  const years = Object.keys(history).map(Number)
  return years.length > 0 ? Math.max(...years) : undefined
}

/**
 * Loads data/emails.json (id -> email), gitignored and local-only — see
 * schema.ts. Only scripts/draw.ts's email-sending step needs this; the CI
 * site build never calls it.
 */
export async function loadEmails(emailsPath: string): Promise<EmailsFile> {
  if (!existsSync(emailsPath)) {
    throw new Error(
      `${emailsPath} not found. Copy data/emails.example.json to data/emails.json and fill in real ` +
        `addresses (it's gitignored — never committed), or run with --dry-run to skip emailing.`
    )
  }
  const raw = JSON.parse(await readFile(emailsPath, 'utf-8'))
  const result = EmailsFileSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`${emailsPath} is invalid:\n${result.error.message}`)
  }
  return result.data
}

export type { HistoryEntry, Person, EmailsFile }
