// Light validation for the JSON "database" files. Keeps the shape honest
// without turning this into a real schema-migration system — see CLAUDE.md.

import { z } from 'zod'

export const PersonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
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

export const HistoryEntrySchema = z.object({
  giverId: z.string().min(1),
  receiverId: z.string().min(1),
  revealToken: z.string().min(1),
})
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>

// Keyed by year as a string (JSON object keys are always strings), e.g. "2025".
export const HistoryFileSchema = z.record(z.string().regex(/^\d{4}$/), z.array(HistoryEntrySchema))
export type HistoryFile = z.infer<typeof HistoryFileSchema>
