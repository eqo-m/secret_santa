// Sends reveal links via Gmail (nodemailer). Called from scripts/draw.ts —
// no queue, no retries beyond what's written here, this runs once a year
// for ~11 people.
//
// GMAIL_USER must have 2FA enabled and GMAIL_APP_PASSWORD must be a
// 16-character app password (not the account login password) —
// generate one at https://myaccount.google.com/apppasswords

import nodemailer from 'nodemailer'

export function createEmailSender({
  gmailUser,
  gmailAppPassword,
}: {
  gmailUser: string
  gmailAppPassword: string
}) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  })

  return async function sendRevealEmail({
    toEmail,
    toName,
    revealUrl,
  }: {
    toEmail: string
    toName: string
    revealUrl: string
  }): Promise<void> {
    await transporter.sendMail({
      from: gmailUser,
      to: toEmail,
      subject: `Your Secret Santa assignment is ready, ${toName}!`,
      html: `
        <p>Ho ho ho, ${escapeHtml(toName)} —</p>
        <p><a href="${escapeHtml(revealUrl)}">Click here to see who you're buying for</a>.</p>
        <p>Happy gifting!</p>
      `,
      text: `Ho ho ho, ${toName} — your Secret Santa assignment is ready: ${revealUrl}\n\nHappy gifting!`,
    })
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
