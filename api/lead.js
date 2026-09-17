/**
 * Lead connector proxy — Vercel Serverless Function, zero dependencies.
 *
 * `window.gooberLead()` (see partials/tracking-head.html) posts here with NO
 * key in the page. This function reads the connector id + key from the
 * Vercel environment — Goober sets these when the CRM connector launch item
 * is saved on a linked project — and forwards the lead. Nothing secret ever
 * reaches the browser.
 *
 * Returns 501 `{ error: "connector not configured" }` when the env is
 * absent, so a site with the connector turned off fails quietly instead of
 * leaking an error to the visitor (the caller uses `sendBeacon`, which
 * ignores the response).
 *
 * `_smoke: true` short-circuits the forward (used by the Launch panel's
 * smoke test) — it reports whether the connector is configured without
 * sending a real lead.
 */
const ENDPOINT = process.env.GOOBER_CONNECTOR_ENDPOINT || "https://adwords.goober.com.au/api";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method Not Allowed");
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const isSmoke = body._smoke === true;

  const connectorId = process.env.GOOBER_CONNECTOR_ID;
  const connectorKey = process.env.GOOBER_CONNECTOR_KEY;
  const configured = Boolean(connectorId && connectorKey);

  if (isSmoke) {
    return res.status(200).json(configured ? { ok: true, smoke: true } : { ok: true, smoke: true, skipped: "not configured" });
  }

  if (!configured) {
    return res.status(501).json({ error: "connector not configured" });
  }

  try {
    const payload = { ...body, key: connectorKey };
    delete payload._smoke;
    const r = await fetch(`${ENDPOINT}/enquiries/${connectorId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok });
  } catch (e) {
    console.error("[lead] forward failed:", e);
    return res.status(502).json({ ok: false, error: "forward failed" });
  }
}
