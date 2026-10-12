// Shared pieces for the public lead-capture routes' notification email.
import { Resend } from 'resend'
import { readServerEnv } from '@/lib/env'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Anything that goes into an email subject: no CR/LF, so a value can never inject headers. */
export function subjectSafe(value: string): string {
  return value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim()
}

export type EmailRow = [label: string, value: string | undefined]

export function renderRows(rows: EmailRow[]): { htmlRows: string; text: string } {
  const present = rows.filter(([, value]) => value)
  return {
    htmlRows: present
      .map(
        ([label, value]) =>
          `<tr><td style="padding:6px 12px;color:#555;font-weight:600;">${escapeHtml(label)}</td><td style="padding:6px 12px;">${escapeHtml(String(value))}</td></tr>`
      )
      .join(''),
    text: present.map(([label, value]) => `${label}: ${value}`).join('\n'),
  }
}

export type LeadEmailResult = { ok: true } | { ok: false; reason: 'not_configured' | 'failed' }

export interface LeadEmailArgs {
  /** Display name + address, e.g. "Grid Nova Contact Form <estimates@gridnova.in>". */
  from: string
  subject: string
  heading: string
  rows: EmailRow[]
  /** A free-text block (already plain text) appended after the table. */
  message?: string
  replyTo?: string
  /** Stable id for the submission, logged on every outcome. */
  submissionId: string
}

/** Send the notification. Never throws; the outcome is a value. */
export async function sendLeadEmail(args: LeadEmailArgs): Promise<LeadEmailResult> {
  const env = readServerEnv()
  if (!env.resendApiKey || env.notifyEmails.length === 0) {
    console.error(`[lead ${args.submissionId}] RESEND_API_KEY / ESTIMATE_NOTIFY_EMAIL is not configured — no notification email sent.`)
    return { ok: false, reason: 'not_configured' }
  }
  const { htmlRows, text } = renderRows(args.rows)
  const html = `
    <div style="font-family:sans-serif;max-width:560px;">
      <h2 style="color:#0e2a63;">${escapeHtml(args.heading)}</h2>
      <table style="border-collapse:collapse;width:100%;">${htmlRows}</table>
      ${args.message ? `<p style="margin-top:16px;color:#111827;white-space:pre-wrap;">${escapeHtml(args.message)}</p>` : ''}
    </div>
  `
  const body = args.message ? [text, '', `Message:\n${args.message}`].join('\n') : text
  try {
    const resend = new Resend(env.resendApiKey)
    const { error } = await resend.emails.send({
      from: args.from,
      to: env.notifyEmails,
      ...(args.replyTo ? { replyTo: args.replyTo } : {}),
      subject: subjectSafe(args.subject),
      html,
      text: body,
    })
    if (error) {
      console.error(`[lead ${args.submissionId}] Resend failed to send the notification email:`, error)
      return { ok: false, reason: 'failed' }
    }
    return { ok: true }
  } catch (err) {
    console.error(`[lead ${args.submissionId}] Unexpected error sending the notification email:`, err)
    return { ok: false, reason: 'failed' }
  }
}
