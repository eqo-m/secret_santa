// Secret Santa assignment logic.
//
// Behavior preserved from the CLAUDE.md reference implementation — refactor
// freely, but the three constraints below (no self, no household, no
// last-year repeat) are hard rules. See CLAUDE.md before changing them.

export type Person = { id: string; name: string; householdId: string }
export type PastAssignment = { year: number; giverId: string; receiverId: string }
export type Assignment = { giverId: string; receiverId: string }

export function generateAssignments({
  people,
  pastAssignments,
  currentYear,
}: {
  people: Person[]
  pastAssignments: PastAssignment[]
  currentYear: number
}): Assignment[] {
  const forbidden = new Map<string, Set<string>>()

  for (const giver of people) {
    const excluded = new Set<string>([giver.id]) // no self
    for (const other of people) {
      if (other.householdId === giver.householdId) excluded.add(other.id) // no household
    }
    const lastYear = pastAssignments.find(
      (p) => p.giverId === giver.id && p.year === currentYear - 1
    )
    if (lastYear) excluded.add(lastYear.receiverId) // no repeat of last year only
    forbidden.set(giver.id, excluded)
  }

  for (const giver of people) {
    if (people.length - forbidden.get(giver.id)!.size <= 0) {
      throw new Error(`No valid recipients for ${giver.name}.`)
    }
  }

  for (let attempt = 0; attempt < 500; attempt++) {
    const result = tryBacktrack(people, forbidden)
    if (result) return result
  }
  throw new Error('Could not find a valid assignment.')
}

function tryBacktrack(
  people: Person[],
  forbidden: Map<string, Set<string>>
): Assignment[] | null {
  const givers = shuffle([...people])
  const availableReceivers = new Set(people.map((p) => p.id))
  const assignments: Assignment[] = []

  function backtrack(index: number): boolean {
    if (index === givers.length) return true
    const giver = givers[index]
    const candidates = shuffle(
      [...availableReceivers].filter((id) => !forbidden.get(giver.id)!.has(id))
    )
    for (const receiverId of candidates) {
      availableReceivers.delete(receiverId)
      assignments.push({ giverId: giver.id, receiverId })
      if (backtrack(index + 1)) return true
      assignments.pop()
      availableReceivers.add(receiverId)
    }
    return false
  }

  return backtrack(0) ? assignments : null
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
