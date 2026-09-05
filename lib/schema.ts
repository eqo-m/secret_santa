// Light validation for the JSON "database" files. Keeps the shape honest
// without turning this into a real schema-migration system — see CLAUDE.md.

import { z } from 'zod'

// No `email` here on purpose — this file is committed to a public repo.
// Emails live in data/emails.json instead, which is gitignored and only
// ever read locally by scripts/draw.ts (never by the CI build that
// publishes site/ — see lib/data.ts).
export const PersonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  householdId: z.string().min(1),
  photoFile: z.string().min(1),
  wishlistUrl: z.string().url(),
})
export type Person = z.infer<typeof PersonSchema>

export const PeopleFileSchema = z.array(PersonSchema).superRefine((people, ctx) => {
  const seen = new Set<string>()
  for (const p of people) {
    if (seen.has(p.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate person id: ${p.id}` })
    }
    seen.add(p.id)
  }
})

// data/emails.json: person id -> email. Gitignored, local-only.
export const EmailsFileSchema = z.record(z.string().min(1), z.string().email())
export type EmailsFile = z.infer<typeof EmailsFileSchema>

export const HistoryEntrySchema = z.object({
  giverId: z.string().min(1),
  receiverId: z.string().min(1),
  revealToken: z.string().min(1),
})
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>

// Keyed by year as a string (JSON object keys are always strings), e.g. "2025".
export const HistoryFileSchema = z.record(z.string().regex(/^\d{4}$/), z.array(HistoryEntrySchema))
export type HistoryFile = z.infer<typeof HistoryFileSchema>
