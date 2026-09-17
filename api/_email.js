/**
 * Shared email sender — zero dependencies, imported by api/enquiry.js and the
 * generated api/_autoreply.js so both callers agree on one provider contract.
 *
 * Provider is EMAIL_PROVIDER = "resend" (default, and the fallback for sites
 * built before this file existed) | "sendgrid". Goober sets the matching key
 * (RESEND_API_KEY or SENDGRID_API_KEY) as a Vercel environment variable when
 * you save the Email launch item — never commit a key.
 *
 * GENERATED infra — edit via the Launch / Email panel, not by hand, unless
 * you are changing the provider contract for BOTH callers.
 */

const PROVIDER = (process.env.EMAIL_PROVIDER || "resend").toLowerCase();

function splitFrom(from) {
  const m = /^(.*)<(.+)>\s*$/.exec(from || "");
  if (!m) return { email: (from || "").trim() };
  return { email: m[2].trim(), name: m[1].trim() || undefined };
}

async function sendViaResend({ from, to, replyTo, subject, text, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: "RESEND_API_KEY not set" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], reply_to: replyTo || undefined, subject, text, html }),
  });
  if (!r.ok) return { ok: false, status: r.status, reason: await r.text().catch(() => "") };
  return { ok: true };
}

async function sendViaSendGrid({ from, to, replyTo, subject, text, html }) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: "SENDGRID_API_KEY not set" };
  const { email: fromEmail, name: fromName } = splitFrom(from);
  const content = [
    ...(text ? [{ type: "text/plain", value: text }] : []),
    ...(html ? [{ type: "text/html", value: html }] : []),
  ];
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: fromName ? { email: fromEmail, name: fromName } : { email: fromEmail },
      reply_to: replyTo ? { email: replyTo } : undefined,
      subject,
      content: content.length ? content : [{ type: "text/plain", value: " " }],
    }),
  });
  if (!r.ok) return { ok: false, status: r.status, reason: await r.text().catch(() => "") };
  return { ok: true };
}

/** Send one email through the configured provider. Never throws. */
export async function sendEmail(opts) {
  try {
    const fn = PROVIDER === "sendgrid" ? sendViaSendGrid : sendViaResend;
    return await fn(opts);
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e) };
  }
}

export const EMAIL_PROVIDER = PROVIDER;
