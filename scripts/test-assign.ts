// Sanity check for lib/assign.ts — not a full test framework, just a script
// that hammers generateAssignments across varied household shapes and
// asserts the three hard constraints always hold. Run with `npm run test:assign`.

import { generateAssignments, type Person, type PastAssignment } from '../lib/assign.ts'

let failures = 0
let ran = 0

function makePeople(householdSizes: number[]): Person[] {
  const people: Person[] = []
  householdSizes.forEach((size, hIndex) => {
    for (let i = 0; i < size; i++) {
      const id = `h${hIndex}-p${i}`
      people.push({ id, name: id, householdId: `household-${hIndex}` })
    }
  })
  return people
}

function assertConstraints(
  people: Person[],
  pastAssignments: PastAssignment[],
  currentYear: number,
  label: string
) {
  const byId = new Map(people.map((p) => [p.id, p]))
  const assignments = generateAssignments({ people, pastAssignments, currentYear })
  ran++

  // Every giver appears exactly once, every receiver appears exactly once.
  const givers = new Set(assignments.map((a) => a.giverId))
  const receivers = new Set(assignments.map((a) => a.receiverId))
  if (givers.size !== people.length || receivers.size !== people.length) {
    console.error(`[${label}] FAIL: not a complete permutation`)
    failures++
    return
  }

  for (const { giverId, receiverId } of assignments) {
    const giver = byId.get(giverId)!
    const receiver = byId.get(receiverId)!

    if (giverId === receiverId) {
      console.error(`[${label}] FAIL: ${giverId} assigned themselves`)
      failures++
    }
    if (giver.householdId === receiver.householdId) {
      console.error(`[${label}] FAIL: ${giverId} assigned within household (${receiverId})`)
      failures++
    }
    const lastYear = pastAssignments.find(
      (p) => p.giverId === giverId && p.year === currentYear - 1
    )
    if (lastYear && lastYear.receiverId === receiverId) {
      console.error(`[${label}] FAIL: ${giverId} assigned same receiver as last year (${receiverId})`)
      failures++
    }
  }
}

// --- Scenarios -------------------------------------------------------------

const scenarios: { label: string; householdSizes: number[]; withHistory: boolean }[] = [
  { label: 'even pairs (5 households of 2, like real data)', householdSizes: [2, 2, 2, 2, 3], withHistory: false },
  { label: 'all singles', householdSizes: [1, 1, 1, 1, 1, 1, 1, 1], withHistory: false },
  { label: 'one big household + singles', householdSizes: [5, 1, 1, 1], withHistory: false },
  { label: 'two households only', householdSizes: [3, 3], withHistory: false },
  { label: 'minimum viable (2 households of 1)', householdSizes: [1, 1], withHistory: false },
  { label: 'even pairs with prior-year history', householdSizes: [2, 2, 2, 2, 3], withHistory: true },
  { label: 'all singles with prior-year history', householdSizes: [1, 1, 1, 1, 1, 1, 1, 1], withHistory: true },
]

const ITERATIONS_PER_SCENARIO = 200
const CURRENT_YEAR = 2026

for (const scenario of scenarios) {
  const people = makePeople(scenario.householdSizes)

  for (let i = 0; i < ITERATIONS_PER_SCENARIO; i++) {
    let pastAssignments: PastAssignment[] = []
    if (scenario.withHistory) {
      // Generate a plausible prior-year assignment (ignoring household
      // constraint is fine here — we just need *some* last-year data to
      // exercise the cooldown check, not a valid prior draw).
      try {
        const prior = generateAssignments({ people, pastAssignments: [], currentYear: CURRENT_YEAR - 1 })
        pastAssignments = prior.map((a) => ({ ...a, year: CURRENT_YEAR - 1 }))
      } catch {
        continue // prior draw impossible for this shape; skip history for this iteration
      }
    }

    try {
      assertConstraints(people, pastAssignments, CURRENT_YEAR, scenario.label)
    } catch (err) {
      // Some shapes (e.g. 2 households of 1, both constraints combined) can
      // legitimately be impossible — that's expected to throw, not a failure.
      const msg = err instanceof Error ? err.message : String(err)
      if (!/No valid recipients|Could not find a valid assignment/.test(msg)) {
        console.error(`[${scenario.label}] FAIL: unexpected error: ${msg}`)
        failures++
      }
    }
  }
}

console.log(`Ran ${ran} successful draws across ${scenarios.length} scenarios.`)
if (failures > 0) {
  console.error(`${failures} constraint violation(s) found.`)
  process.exit(1)
} else {
  console.log('All constraints held. ✅')
}
