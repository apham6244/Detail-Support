/**
 * Template rendering with [Bracket] merge variables.
 *
 * Supported tokens (case- and spacing-insensitive):
 *   [Business Name]  [Contact Name]  [First Name]  [City]  [My Name]  [My Business]
 */

export interface RenderContext {
  businessName?: string | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  city?: string | null;
  senderName: string;
  myBusiness: string;
  unsubscribeUrl: string;
  businessAddress: string;
}

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Resolve the raw (unescaped) value for each supported token. */
function buildValues(ctx: RenderContext): Record<string, string> {
  const fullName = [ctx.contactFirstName, ctx.contactLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    "business name": ctx.businessName?.trim() || "there",
    "contact name": fullName || "there",
    "first name": ctx.contactFirstName?.trim() || "there",
    city: ctx.city?.trim() || "your area",
    "my name": ctx.senderName,
    "my business": ctx.myBusiness,
  };
}

/** Replace every [Token] using a normalized lookup; unknown tokens are kept. */
function applyVariables(text: string, values: Record<string, string>): string {
  return text.replace(/\[([^\]]+)\]/g, (whole, inner: string) => {
    const v = values[normalizeKey(inner)];
    return v !== undefined ? v : whole;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function renderEmail(
  subject: string,
  body: string,
  ctx: RenderContext
): RenderedEmail {
  const values = buildValues(ctx);
  const escapedValues = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, escapeHtml(v)])
  );

  const renderedSubject = applyVariables(subject, values);
  const renderedTextBody = applyVariables(body, values);

  const text = `${renderedTextBody}\n\n--\n${ctx.businessAddress}\nUnsubscribe: ${ctx.unsubscribeUrl}`;

  const htmlBody = applyVariables(escapeHtml(body), escapedValues).replace(
    /\n/g,
    "<br>"
  );

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fb;padding:24px;font-family:Segoe UI,Arial,sans-serif;color:#0e1626;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e8f1;border-radius:12px;padding:28px;line-height:1.6;font-size:15px;">
    ${htmlBody}
    <hr style="border:none;border-top:1px solid #edf0f6;margin:24px 0 12px;">
    <p style="font-size:12px;color:#7e8aa3;margin:0;">
      ${escapeHtml(ctx.businessAddress)}<br>
      <a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:#7e8aa3;">Unsubscribe</a>
    </p>
  </div>
</body></html>`;

  return { subject: renderedSubject, text, html };
}
