// Sends each giver their reveal link via Resend. Called once per person from
// scripts/draw.ts — no queue, no retries beyond what's written here, this
// runs once a year for ~11 people.

import { Resend } from 'resend'

export async function sendRevealEmail({
  apiKey,
  fromAddress,
  toEmail,
  toName,
  revealUrl,
}: {
  apiKey: string
  fromAddress: string
  toEmail: string
  toName: string
  revealUrl: string
}): Promise<void> {
  const resend = new Resend(apiKey)

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: toEmail,
    subject: '🎁 Your Secret Santa assignment',
    html: `
      <p>Hi ${escapeHtml(toName)},</p>
      <p>Your Secret Santa assignment is ready.</p>
      <p><a href="${escapeHtml(revealUrl)}">Click here to see who you're buying for</a></p>
      <p>Happy gifting!</p>
    `,
    text: `Hi ${toName},\n\nYour Secret Santa assignment is ready: ${revealUrl}\n\nHappy gifting!`,
  })

  if (error) {
    throw new Error(`Failed to email ${toEmail}: ${error.message}`)
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
