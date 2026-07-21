import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { serviceClient } from "../config/supabase";
import { getEmailProvider } from "../email";
import { getSmsProvider } from "../sms";
import { ApiError } from "../utils/ApiError";
import { renderMessage, reachable, resolveSegment, SEGMENT_KEYS, type SegmentKey } from "./segments";

/**
 * Notifications are addressed by REFERENCE, never by recipient.
 *
 * The caller sends an id ("send invitation X"); this service resolves the
 * record through the caller's own RLS-scoped Supabase client, so the database
 * decides whether they may touch it — a caller who can't see the row gets a
 * 404 and nothing is sent. That also means this endpoint can't be abused as an
 * open relay: the recipient address always comes from our data, never the
 * request body.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shell(title: string, bodyHtml: string, footer?: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f8fd;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0e1626">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:14px;padding:28px">
      <tr><td>
        <div style="font-weight:800;font-size:15px;color:#2e7bff;margin-bottom:18px">Detail Support</div>
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${esc(title)}</h1>
        ${bodyHtml}
        ${footer ? `<p style="margin:22px 0 0;font-size:12px;color:#7b879f">${footer}</p>` : ""}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

const button = (url: string, label: string) =>
  `<p style="margin:22px 0"><a href="${esc(url)}" style="background:#2e7bff;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:600;display:inline-block">${esc(label)}</a></p>
   <p style="margin:0;font-size:12px;color:#7b879f">Or paste this link: ${esc(url)}</p>`;

/** Send a team invitation email for an invitation the caller may see. */
export async function sendInvitation(db: SupabaseClient, invitationId: string) {
  const { data: inv } = await db
    .from("invitations")
    .select("id, org_id, email, role, token, accepted_at, revoked_at, expires_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) throw ApiError.notFound("Invitation not found");
  if (inv.accepted_at) throw new ApiError(409, "That invitation has already been accepted.");
  if (inv.revoked_at) throw new ApiError(409, "That invitation was revoked.");

  const { data: org } = await db
    .from("organizations")
    .select("name")
    .eq("id", inv.org_id)
    .maybeSingle();
  const shopName = org?.name ?? "your shop";
  const roleLabel = inv.role === "admin" ? "Admin" : inv.role === "owner" ? "Owner" : "Detailer";
  const link = `${env.APP_URL}/accept-invite?token=${inv.token}`;

  const html = shell(
    `You're invited to join ${shopName}`,
    `<p style="margin:0;font-size:15px;line-height:1.6;color:#43506b">
       You've been invited to join <b>${esc(shopName)}</b> on Detail Support as <b>${esc(roleLabel)}</b>.
     </p>${button(link, `Join ${shopName}`)}`,
    `This invite expires ${new Date(inv.expires_at).toLocaleDateString()}. If you weren't expecting it, you can ignore this email.`
  );
  const text = `You're invited to join ${shopName} on Detail Support as ${roleLabel}.\n\nAccept: ${link}\n\nThis invite expires ${new Date(inv.expires_at).toLocaleDateString()}.`;

  const result = await getEmailProvider().send({
    to: inv.email,
    subject: `Join ${shopName} on Detail Support`,
    html,
    text,
    customArgs: { invitation_id: inv.id },
  });

  return { channel: "email" as const, to: inv.email, provider: getEmailProvider().name, ...result };
}

/** Send an appointment reminder for a reminder row the caller may see. */
export async function sendReminder(db: SupabaseClient, reminderId: string) {
  const { data: rem } = await db
    .from("appointment_reminders")
    .select("id, org_id, appointment_id, channel, status")
    .eq("id", reminderId)
    .maybeSingle();
  if (!rem) throw ApiError.notFound("Reminder not found");
  if (rem.status === "sent") throw new ApiError(409, "That reminder was already sent.");

  const { data: appt } = await db
    .from("appointments")
    .select("scheduled_at, customer:customers(name, email, phone), service:services(name)")
    .eq("id", rem.appointment_id)
    .maybeSingle();
  if (!appt) throw ApiError.notFound("The job for this reminder is no longer available");

  const { data: org } = await db.from("organizations").select("name").eq("id", rem.org_id).maybeSingle();

  const customer = (appt as any).customer as { name: string; email: string | null; phone: string | null } | null;
  const service = (appt as any).service as { name: string } | null;
  const shopName = org?.name ?? "your detailer";
  const when = new Date((appt as any).scheduled_at).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const firstName = (customer?.name ?? "there").split(" ")[0];
  const job = service?.name ? `your ${service.name}` : "your detail";

  let sent: { channel: "sms" | "email"; to: string; provider: string; providerMessageId: string | null };

  if (rem.channel === "sms") {
    if (!customer?.phone) throw new ApiError(422, `${customer?.name ?? "That customer"} has no phone number on file.`);
    const body = `Hi ${firstName}, a reminder that ${job} with ${shopName} is ${when}. Reply here if you need to reschedule.`;
    const r = await getSmsProvider().send({ to: customer.phone, body, reference: rem.id });
    sent = { channel: "sms", to: customer.phone, provider: getSmsProvider().name, ...r };
  } else {
    if (!customer?.email) throw new ApiError(422, `${customer?.name ?? "That customer"} has no email on file.`);
    const html = shell(
      `Reminder: ${job} on ${when}`,
      `<p style="margin:0;font-size:15px;line-height:1.6;color:#43506b">
         Hi ${esc(firstName)}, a quick reminder that <b>${esc(job)}</b> with <b>${esc(shopName)}</b> is <b>${esc(when)}</b>.
       </p>`,
      `Need to reschedule? Just reply to this email.`
    );
    const r = await getEmailProvider().send({
      to: customer.email,
      subject: `Reminder: ${job} on ${when}`,
      html,
      text: `Hi ${firstName}, a reminder that ${job} with ${shopName} is ${when}.`,
      customArgs: { reminder_id: rem.id },
    });
    sent = { channel: "email", to: customer.email, provider: getEmailProvider().name, ...r };
  }

  // Record the send through the caller's client — RLS still applies.
  await db
    .from("appointment_reminders")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", rem.id);

  return sent;
}

/**
 * Bulk-send a campaign.
 *
 * The recipient list is NOT taken from the request: it's recomputed here from
 * current customer + appointment data through the caller's RLS-scoped client,
 * so a stale preview can't send to the wrong people and a caller can't inject
 * addresses. Each recipient is sent independently — one bad address can't take
 * the batch down — and the campaign records how many landed vs failed.
 */
export async function sendCampaign(db: SupabaseClient, campaignId: string) {
  const { data: c } = await db
    .from("marketing_campaigns")
    .select("id, org_id, name, segment, channel, subject, message, status")
    .eq("id", campaignId)
    .maybeSingle();
  if (!c) throw ApiError.notFound("Campaign not found");
  if (c.status === "sent") throw new ApiError(409, "That campaign was already sent.");
  if (!c.message?.trim()) throw new ApiError(422, "This campaign has no message yet.");
  if (!SEGMENT_KEYS.includes(c.segment as SegmentKey)) throw new ApiError(422, "Unknown audience segment.");

  const { data: org } = await db.from("organizations").select("name").eq("id", c.org_id).maybeSingle();
  const shopName = org?.name ?? "your detailer";

  const audience = await resolveSegment(db, c.org_id, c.segment as SegmentKey);
  const recipients = reachable(audience, c.channel);
  if (recipients.length === 0) {
    throw new ApiError(
      422,
      `Nobody in "${c.segment}" has ${c.channel === "sms" ? "a phone number" : "an email"} on file.`
    );
  }

  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (const person of recipients) {
    try {
      const body = renderMessage(c.message, person.name, shopName);
      if (c.channel === "sms") {
        await getSmsProvider().send({ to: person.phone!, body, reference: c.id });
      } else {
        await getEmailProvider().send({
          to: person.email!,
          subject: c.subject?.trim() || `A note from ${shopName}`,
          html: shell(c.subject?.trim() || `A note from ${shopName}`,
            `<p style="margin:0;font-size:15px;line-height:1.6;color:#43506b">${esc(body).replace(/\n/g, "<br>")}</p>`,
            `You're receiving this because you're a customer of ${esc(shopName)}.`),
          text: body,
          customArgs: { campaign_id: c.id, customer_id: person.id },
        });
      }
      sent += 1;
    } catch (e) {
      failed += 1;
      lastError = (e as Error).message;
    }
  }

  // Record the outcome even if some failed — the audit trigger logs campaign.sent.
  await db
    .from("marketing_campaigns")
    .update({
      status: sent > 0 ? "sent" : "draft",
      recipient_count: sent,
      failed_count: failed,
      last_error: lastError,
      sent_at: sent > 0 ? new Date().toISOString() : null,
    })
    .eq("id", c.id);

  if (sent === 0) throw new ApiError(502, `No messages could be sent. Last error: ${lastError}`);

  return {
    channel: c.channel as "email" | "sms",
    provider: c.channel === "sms" ? getSmsProvider().name : getEmailProvider().name,
    audience: audience.length,
    sent,
    failed,
    skipped: audience.length - recipients.length,
  };
}

/**
 * Drain due reminders. Safe to call on a timer and from more than one instance:
 * claim_due_reminders() hands each row to exactly one caller, so a reminder is
 * never sent twice. A row that throws goes back to pending for a later attempt,
 * or to failed once it's out of attempts.
 */
export async function runDueReminders(limit = 25) {
  const svc = serviceClient();
  if (!svc) return { ran: false as const, reason: "no service role key configured" };

  // Rescue anything a crash left mid-flight before claiming new work.
  await svc.rpc("requeue_stale_reminders", { p_older_than: "10 minutes" });

  const { data: claimed, error } = await svc.rpc("claim_due_reminders", { p_limit: limit });
  if (error) throw new Error(error.message);

  const rows = (claimed ?? []) as { id: string; attempts: number }[];
  let sent = 0;
  let failed = 0;

  for (const r of rows) {
    try {
      // sendReminder marks the row sent on success; it accepts our claimed row
      // because 'sending' is not 'sent'.
      await sendReminder(svc, r.id);
      sent += 1;
    } catch (e) {
      failed += 1;
      const message = (e as Error).message;
      // Out of attempts, or a permanent problem (no phone/email) — stop retrying.
      const permanent = /no (phone number|email)/i.test(message) || r.attempts >= 3;
      await svc
        .from("appointment_reminders")
        .update({ status: permanent ? "failed" : "pending", last_error: message })
        .eq("id", r.id);
    }
  }

  return { ran: true as const, claimed: rows.length, sent, failed };
}

/** What's actually wired up — the UI uses this to stop promising real sends. */
export function deliveryStatus() {
  return {
    email: { provider: env.EMAIL_PROVIDER, live: env.emailLive },
    sms: { provider: env.SMS_PROVIDER, live: env.smsLive },
  };
}
