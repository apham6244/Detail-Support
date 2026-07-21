import { useEffect, useState } from "react";
import { api, apiConfigured } from "./api";

/**
 * Delivery goes through the API server, because provider keys are secrets and
 * can never live in the browser. Sends are addressed by record id — the server
 * resolves the recipient itself — so nothing here can be used to email an
 * arbitrary address.
 */

export interface DeliveryStatus {
  /** Is the API server actually reachable right now? */
  reachable: boolean;
  email: { provider: string; live: boolean };
  sms: { provider: string; live: boolean };
}

const OFFLINE: DeliveryStatus = {
  reachable: false,
  email: { provider: "none", live: false },
  sms: { provider: "none", live: false },
};

export async function sendInvitationEmail(invitationId: string) {
  return api<{ channel: string; to: string; provider: string }>("/notify/invitation", {
    method: "POST",
    body: JSON.stringify({ invitationId }),
  });
}

export async function sendReminderNow(reminderId: string) {
  return api<{ channel: string; to: string; provider: string }>("/notify/reminder", {
    method: "POST",
    body: JSON.stringify({ reminderId }),
  });
}

/**
 * What delivery is actually wired up. Everything degrades gracefully: if the
 * API isn't running or no provider is configured, the UI keeps its manual
 * copy-link / mark-sent flows instead of promising a send it can't make.
 */
export function useDelivery(): DeliveryStatus {
  const [status, setStatus] = useState<DeliveryStatus>(OFFLINE);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!apiConfigured) return;
      try {
        const s = await api<Omit<DeliveryStatus, "reachable">>("/notify/status");
        if (active) setStatus({ ...s, reachable: true });
      } catch {
        if (active) setStatus(OFFLINE); // server down — stay in manual mode
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return status;
}
