// Detail Support domain types (Phase 1). Mirror the Supabase tables.

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  // How this customer found the shop. Optional: the column ships in migration
  // 027, so on un-migrated databases `select("*")` simply omits it (undefined).
  referral_source?: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  customer_id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  license_plate: string | null;
  vin: string | null;
  notes: string | null;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_min: number;
  category: string | null;
  active: boolean;
}

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Appointment {
  id: string;
  customer_id: string;
  vehicle_id: string | null;
  service_id: string | null;
  assigned_to: string | null; // auth user id of the assigned team member
  scheduled_at: string;
  duration_min: number;
  status: AppointmentStatus;
  price: number | null;
  notes: string | null;
  // joined for display
  customer?: { name: string } | null;
  vehicle?: { year: number | null; make: string | null; model: string | null } | null;
  service?: { name: string } | null;
}

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export function vehicleLabel(v?: {
  year: number | null;
  make: string | null;
  model: string | null;
} | null): string {
  if (!v) return "—";
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
}

export type InvoiceStatus = "unpaid" | "deposit_paid" | "balance_due" | "paid";

export interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string | null;
  customer_id: string;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  deposit_amount: number;
  notes: string | null;
  issued_at: string;
  /** Payment due date (nullable in the DB; used to derive "overdue"). */
  due_at?: string | null;
  sent_at: string | null;
  created_at: string;
  customer?: { name: string } | null;
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  unpaid: "Unpaid",
  deposit_paid: "Deposit paid",
  balance_due: "Balance due",
  paid: "Paid",
};

// ---- Team / roles ---------------------------------------------------------

export type Role = "owner" | "admin" | "employee";

/** Employee is presented as "Detailer" in the UI. */
export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  employee: "Detailer",
};

export const ROLE_BLURB: Record<Role, string> = {
  owner: "Full control — billing, team, and ownership.",
  admin: "Manages customers, appointments, services, and invoices.",
  employee: "Books and works jobs. No billing or team access.",
};

export interface TeamMember {
  id: string; // membership id
  user_id: string;
  role: Role;
  status: string;
  created_at: string;
  profile?: { full_name: string | null; email: string | null } | null;
}

export interface Invitation {
  id: string;
  org_id: string;
  email: string;
  role: Role;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export function inviteStatus(inv: Invitation): InviteStatus {
  if (inv.accepted_at) return "accepted";
  if (inv.revoked_at) return "revoked";
  if (new Date(inv.expires_at) < new Date()) return "expired";
  return "pending";
}

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  revoked: "Revoked",
  expired: "Expired",
};

// ---- Billing / plans ------------------------------------------------------

export type BillingPlan = "free" | "pro" | "team";
export type BillingStatus = "trialing" | "active" | "past_due" | "canceled";

// Plan pricing, limits, and features now live in the database (plans /
// features / plan_features, migration 015) and are loaded via
// useEntitlements(). This keeps the frontend in lock-step with the server.

export const BILLING_STATUS_LABEL: Record<BillingStatus, string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};

// ---- Quotes ---------------------------------------------------------------

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired";

export interface QuoteLineItem {
  id?: string;
  service_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Quote {
  id: string;
  number: string | null;
  customer_id: string;
  vehicle_id: string | null;
  status: QuoteStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string | null;
  /** Private staff-only note — ships in migration 028, so optional on
   *  un-migrated databases (a `select("*")` simply omits it). */
  internal_notes?: string | null;
  valid_until: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  converted_invoice_id: string | null;
  converted_appointment_id: string | null;
  created_at: string;
  customer?: { name: string } | null;
  vehicle?: { year: number | null; make: string | null; model: string | null } | null;
}

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

/** A sent quote past its valid_until date reads as expired (mirrors the DB). */
export function effectiveQuoteStatus(q: Quote): QuoteStatus {
  if (q.status === "sent" && q.valid_until && new Date(q.valid_until) < new Date()) return "expired";
  return q.status;
}

// ---- Marketing ------------------------------------------------------------

export type CampaignStatus = "draft" | "sent";

export interface Campaign {
  id: string;
  name: string;
  segment: string;
  channel: string;
  subject: string | null;
  message: string;
  status: CampaignStatus;
  recipient_count: number;
  sent_at: string | null;
  created_at: string;
}

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  sent: "Sent",
};

// ---- Reminders ------------------------------------------------------------

export type ReminderStatus = "pending" | "sent" | "cancelled";

export interface Reminder {
  id: string;
  appointment_id: string;
  remind_at: string;
  channel: string;
  status: ReminderStatus;
  sent_at: string | null;
  created_at: string;
}

export const REMINDER_STATUS_LABEL: Record<ReminderStatus, string> = {
  pending: "Pending",
  sent: "Sent",
  cancelled: "Cancelled",
};

// ---- Job photos -----------------------------------------------------------

export interface JobPhoto {
  id: string;
  customer_id: string;
  vehicle_id: string | null;
  appointment_id: string | null;
  storage_path: string;
  caption: string | null;
  created_at: string;
  /** Short-lived signed URL, resolved client-side (the bucket is private). */
  url?: string;
}

// ---- Reviews --------------------------------------------------------------
// Reviews are NOT stored here. The Reviews page reads them live from the shop's
// connected Google Business Profile via the server (see useGoogleReviews) —
// there is deliberately no local review table or manual entry.

// ---- Leads ----------------------------------------------------------------

export type LeadStatus = "new" | "contacted" | "quote_sent" | "scheduled" | "won" | "lost";

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quote_sent: "Quote sent",
  scheduled: "Scheduled",
  won: "Won",
  lost: "Lost",
};

/** Pipeline order for status columns / sorting. */
export const LEAD_STATUS_ORDER: LeadStatus[] = ["new", "contacted", "quote_sent", "scheduled", "won", "lost"];

export type LeadSource = "facebook" | "instagram" | "google" | "referral" | "website" | "walk_in" | "other";

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  google: "Google",
  referral: "Referral",
  website: "Website",
  walk_in: "Walk-in",
  other: "Other",
};

export interface Lead {
  id: string;
  org_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  vehicle: string | null;
  service: string | null;
  estimated_value: number | null;
  source: LeadSource | null;
  status: LeadStatus;
  notes: string | null;
  last_contacted_at: string | null;
  converted_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  org_id: string;
  lead_id: string;
  type: string; // note | status_change | contacted | created | converted
  body: string | null;
  created_at: string;
}
