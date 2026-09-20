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
      subject: `Dein Wichtel steht fest, ${toName}!`,
      html: `
        <p>Hallo ${escapeHtml(toName)} —</p>
        <p><a href="${escapeHtml(revealUrl)}">Folge dem Link, um herauszufinden, wen du bewichteln darfst</a>.</p>
        <p>Viel Spaß beim Beschenken!</p>
      `,
      text: `Hallo ${toName} — folge dem Link, um herauszufinden, wen du bewichteln darfst ${revealUrl}\n\nViel Spaß beim Beschenken!`,
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
