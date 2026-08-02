import { useState } from "react";
import {
  UserPlus,
  Crown,
  Copy,
  Check,
  RotateCw,
  Ban,
  Trash2,
  Mail,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal, Field } from "@/components/ui/Modal";
import { SignInPrompt, EmptyState } from "@/components/ui/data";
import { confirm, toast } from "@/components/ui/feedback";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { EmptyArt } from "@/components/ui/EmptyArt";
import { FeatureLocked } from "@/components/UpgradeGate";
import { useEntitlements } from "@/lib/entitlements";
import { useDelivery, sendInvitationEmail } from "@/lib/notify";
import { useTeam, inviteLink } from "@/hooks/useTeam";
import {
  ROLE_LABEL,
  ROLE_BLURB,
  INVITE_STATUS_LABEL,
  inviteStatus,
  type Role,
  type Invitation,
  type TeamMember,
  type InviteStatus,
} from "@/lib/models";
import { cn } from "@/lib/cn";

const ROLE_BADGE: Record<Role, string> = {
  owner: "bg-brand-500/10 text-brand-500",
  admin: "bg-violet/10 text-violet",
  employee: "bg-ink3/10 text-ink2",
};

const INVITE_BADGE: Record<InviteStatus, string> = {
  pending: "bg-warning/10 text-warning",
  accepted: "bg-success/10 text-success",
  revoked: "bg-ink3/10 text-ink3",
  expired: "bg-danger/10 text-danger",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function Team() {
  const team = useTeam();
  const ent = useEntitlements();
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!team.ready) return <SignInPrompt what="team" />;

  // Detailers (employees) don't manage the team.
  if (team.role === "employee") {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Team" subtitle="Your shop's members" />
        <EmptyState
          art="key"
          title="Team management is for owners and admins"
          body="You're a Detailer on this workspace. Ask an owner or admin if you need access changed."
        />
      </div>
    );
  }

  // Team features (multiple employees, roles, assignments) require the Team plan.
  if (ent.loading) return <PageSkeleton variant="plain" className="mx-auto max-w-3xl" />;
  if (!ent.hasFeature("team_members")) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Team" subtitle="Members, roles, and invitations" />
        <FeatureLocked
          feature="team_members"
          title="Team"
          description="Add employee accounts, set roles and permissions, and manage your crew together."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Team"
        subtitle="Members, roles, and invitations"
        actions={
          <Button variant="primary" icon={<UserPlus />} onClick={() => setInviteOpen(true)}>
            Invite teammate
          </Button>
        }
      />

      {team.loading ? (
        <PageSkeleton variant="plain" header={false} className="mx-auto max-w-3xl" />
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          <MembersCard team={team} />
          <InvitationsCard team={team} />
        </div>
      )}

      <InviteModal team={team} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

function MembersCard({ team }: { team: ReturnType<typeof useTeam> }) {
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title="Members"
      subtitle={`${team.members.length} ${team.members.length === 1 ? "person" : "people"}`}
    >
      {team.members.map((m) => (
        <MemberRow
          key={m.id}
          member={m}
          team={team}
          busy={busy === m.id}
          onChangeRole={(r) => act(m.id, () => team.changeRole(m.id, r))}
          onRemove={async () => {
            if (await confirm({ title: `Remove ${memberName(m)}?`, body: "They lose access to this workspace. You can re-invite them later.", confirmLabel: "Remove teammate", tone: "danger" }))
              act(m.id, () => team.removeMember(m.id));
          }}
          onTransfer={async () => {
            if (await confirm({ title: `Transfer ownership to ${memberName(m)}?`, body: "You'll become an admin. Only the new owner can transfer it back.", confirmLabel: "Transfer ownership", tone: "danger" }))
              act(m.id, () => team.transferOwnership(m.id));
          }}
        />
      ))}
    </Panel>
  );
}

/** A borderless section: heading (+ optional subtitle), then content. */
function Panel({ title, subtitle, className, children }: {
  title: string; subtitle?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">{title}</h2>
        {subtitle && <span className="text-[12px] font-medium text-ink3">· {subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function MemberRow({
  member,
  team,
  busy,
  onChangeRole,
  onRemove,
  onTransfer,
}: {
  member: TeamMember;
  team: ReturnType<typeof useTeam>;
  busy: boolean;
  onChangeRole: (r: Role) => void;
  onRemove: () => void;
  onTransfer: () => void;
}) {
  const isSelf = member.user_id === team.currentUserId;
  const isOwnerRow = member.role === "owner";
  // Owner can manage everyone except the owner row.
  const canManage = team.isOwner && !isOwnerRow;

  return (
    <div className="flex items-center gap-3 border-b border-line2 py-3 last:border-b-0">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-500/10 text-[12.5px] font-bold uppercase text-brand-500">
        {(memberName(member) || "?").slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold">{memberName(member)}</span>
          {isSelf && (
            <span className="rounded-full bg-line2 px-1.5 py-0.5 text-[10px] font-semibold text-ink3">
              You
            </span>
          )}
        </div>
        <div className="truncate text-xs text-ink3">
          {member.profile?.email ?? "—"} · Joined {fmtDate(member.created_at)}
        </div>
      </div>

      {canManage ? (
        <select
          value={member.role}
          disabled={busy}
          onChange={(e) => onChangeRole(e.target.value as Role)}
          className="h-8 rounded-lg border border-line bg-panel2 px-2 text-[12.5px] font-medium text-ink focus:border-brand-500 focus:outline-none disabled:opacity-50"
        >
          <option value="admin">Admin</option>
          <option value="employee">Detailer</option>
        </select>
      ) : (
        <span
          className={cn(
            "flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold",
            ROLE_BADGE[member.role]
          )}
        >
          {isOwnerRow && <Crown className="h-3 w-3" />}
          {ROLE_LABEL[member.role]}
        </span>
      )}

      {canManage && (
        <div className="flex items-center gap-1">
          <IconAction label="Make owner" onClick={onTransfer} disabled={busy}>
            <Crown className="h-4 w-4" />
          </IconAction>
          <IconAction label="Remove" onClick={onRemove} disabled={busy} danger>
            <Trash2 className="h-4 w-4" />
          </IconAction>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

function InvitationsCard({ team }: { team: ReturnType<typeof useTeam> }) {
  const pending = team.invitations.filter((i) => inviteStatus(i) === "pending");
  const past = team.invitations.filter((i) => inviteStatus(i) !== "pending");

  return (
    <Panel
      title="Invitations"
      subtitle={pending.length ? `${pending.length} pending` : undefined}
      className="border-t border-line pt-8"
    >
      {team.invitations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <EmptyArt variant="key" className="w-[150px]" />
          <div className="text-[13.5px] font-semibold">No invitations yet</div>
          <div className="max-w-xs text-xs text-ink3">
            Invite a teammate by email — they'll get a link to join this workspace.
          </div>
        </div>
      ) : (
        <>
          {pending.map((inv) => (
            <InviteRow key={inv.id} inv={inv} team={team} />
          ))}
          {past.map((inv) => (
            <InviteRow key={inv.id} inv={inv} team={team} />
          ))}
        </>
      )}
    </Panel>
  );
}

function InviteRow({ inv, team }: { inv: Invitation; team: ReturnType<typeof useTeam> }) {
  const status = inviteStatus(inv);
  const delivery = useDelivery();
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const emailIt = async () => {
    setBusy(true);
    try {
      const r = await sendInvitationEmail(inv.id);
      setSent(true);
      setTimeout(() => setSent(false), 2500);
      if (!delivery.email.live) {
        toast.info(`Invite logged via ${r.provider}. Live email isn't switched on yet, so it wasn't sent to ${r.to}.`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(inviteLink(inv.token));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 border-b border-line2 py-3 last:border-b-0">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-line2 text-ink3">
        <Mail className="h-[17px] w-[17px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">{inv.email}</div>
        <div className="truncate text-xs text-ink3">
          {ROLE_LABEL[inv.role]} ·{" "}
          {status === "pending" ? `Expires ${fmtDate(inv.expires_at)}` : `Invited ${fmtDate(inv.created_at)}`}
        </div>
      </div>

      <span
        className={cn(
          "whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold",
          INVITE_BADGE[status]
        )}
      >
        {INVITE_STATUS_LABEL[status]}
      </span>

      {status === "pending" ? (
        <div className="flex items-center gap-1">
          {delivery.reachable && (
            <IconAction label={delivery.email.live ? "Email this invite" : "Email invite (delivery not switched on)"} onClick={emailIt} disabled={busy}>
              {sent ? <Check className="h-4 w-4 text-success" /> : <Mail className="h-4 w-4" />}
            </IconAction>
          )}
          <IconAction label="Copy invite link" onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </IconAction>
          <IconAction label="Resend" onClick={() => run(() => team.resend(inv.id))} disabled={busy}>
            <RotateCw className="h-4 w-4" />
          </IconAction>
          <IconAction
            label="Revoke"
            onClick={() => run(() => team.revoke(inv.id))}
            disabled={busy}
            danger
          >
            <Ban className="h-4 w-4" />
          </IconAction>
        </div>
      ) : (
        <IconAction label="Delete" onClick={() => run(() => team.deleteInvite(inv.id))} disabled={busy} danger>
          <Trash2 className="h-4 w-4" />
        </IconAction>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invite modal
// ---------------------------------------------------------------------------

function InviteModal({
  team,
  open,
  onClose,
}: {
  team: ReturnType<typeof useTeam>;
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => {
    setEmail("");
    setRole("employee");
    setError(null);
    setCreated(null);
    setCopied(false);
    onClose();
  };

  const submit = async () => {
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const inv = await team.invite(email, role);
      setCreated(inv);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(inviteLink(created.token));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={created ? "Invitation ready" : "Invite a teammate"}
      footer={
        created ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {busy ? "Creating…" : "Create invitation"}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-ink2">
            Share this secure link with <b>{created.email}</b>. They'll join{" "}
            <b>{ROLE_LABEL[created.role]}</b> after signing in with that email.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-panel2 p-2">
            <input
              readOnly
              value={inviteLink(created.token)}
              className="min-w-0 flex-1 bg-transparent px-2 text-[12.5px] text-ink outline-none"
            />
            <Button variant="primary" icon={copied ? <Check /> : <Copy />} onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-ink3">
            The link expires in 7 days. You can resend or revoke it anytime from the Invitations list.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Email address">
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              autoFocus
            />
          </Field>
          <Field label="Role">
            <div className="flex flex-col gap-2">
              {(team.isOwner ? (["admin", "employee"] as Role[]) : (["employee"] as Role[])).map(
                (r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                      role === r ? "border-brand-500 bg-brand-500/[0.06]" : "border-line hover:border-ink3"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border-2",
                        role === r ? "border-brand-500 bg-brand-500 text-white" : "border-line"
                      )}
                    >
                      {role === r && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                    <div>
                      <div className="text-[13.5px] font-semibold">{ROLE_LABEL[r]}</div>
                      <div className="text-xs text-ink3">{ROLE_BLURB[r]}</div>
                    </div>
                  </button>
                )
              )}
            </div>
          </Field>
          {!team.isOwner && (
            <p className="text-xs text-ink3">Admins can invite Detailers. Only the owner can add admins.</p>
          )}
          {error && (
            <div className="rounded-lg bg-danger/10 px-3 py-2.5 text-[12.5px] text-danger">{error}</div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function IconAction({
  children,
  onClick,
  label,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-ink3 transition-[transform,background-color,color] duration-150 ease-out active:scale-90 disabled:opacity-40 disabled:pointer-events-none",
        danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-line2 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

function memberName(m: TeamMember): string {
  return m.profile?.full_name?.trim() || m.profile?.email || "Member";
}
