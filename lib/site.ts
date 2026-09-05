// Regenerates site/ from a set of people + history entries. Pure output —
// safe to re-run any time (e.g. in CI on every push), never touches
// history.json and never sends email. Shared by scripts/draw.ts and
// scripts/build-site.ts.

import { writeFile, mkdir, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { generateRevealHtml } from './reveal.ts'
import type { HistoryEntry, Person } from './schema.ts'

export async function generateRevealPages({
  people,
  entries,
  photosDir,
  siteDir,
}: {
  people: Person[]
  entries: HistoryEntry[]
  photosDir: string
  siteDir: string
}): Promise<void> {
  const byId = new Map(people.map((p) => [p.id, p]))
  const sitePhotosDir = path.join(siteDir, 'photos')
  await mkdir(siteDir, { recursive: true })
  await mkdir(sitePhotosDir, { recursive: true })

  for (const entry of entries) {
    const giver = byId.get(entry.giverId)
    const receiver = byId.get(entry.receiverId)
    if (!giver || !receiver) {
      throw new Error(`Assignment references unknown person: ${entry.giverId} -> ${entry.receiverId}`)
    }

    const srcPhoto = path.join(photosDir, receiver.photoFile)
    if (!existsSync(srcPhoto)) {
      throw new Error(
        `Missing photo for ${receiver.name}: expected photos/${receiver.photoFile}. ` +
          `Add it before building the site (see photos/README.md).`
      )
    }
    await copyFile(srcPhoto, path.join(sitePhotosDir, receiver.photoFile))

    const html = generateRevealHtml({
      giverName: giver.name,
      receiverName: receiver.name,
      receiverPhotoPath: `photos/${receiver.photoFile}`,
      receiverWishlistUrl: receiver.wishlistUrl,
    })
    await writeFile(path.join(siteDir, `reveal-${entry.revealToken}.html`), html)
  }
}
