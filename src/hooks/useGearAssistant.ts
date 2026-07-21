import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface AssistantAnswer {
  recommendation: string;
  explanation: string;
  pros: string[];
  cons: string[];
  alternatives: { name: string; note: string }[];
  learn: string;
}

export interface AssistantContext {
  experience?: string;
  budget?: string;
  goal?: string;
  currentEquipment?: string;
}

/**
 * Talks to the server-side Gear Assistant. The Anthropic key lives on the
 * server — the browser only ever posts a question here. `configured` reflects
 * whether the server has a key; when false the UI hides the feature instead of
 * offering something that can't work.
 */
export function useGearAssistant() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ configured: boolean }>("/gear/status")
      .then((s) => alive && setConfigured(s.configured))
      .catch(() => alive && setConfigured(false));
    return () => {
      alive = false;
    };
  }, []);

  const ask = useCallback(async (question: string, ctx: AssistantContext) => {
    setLoading(true);
    setError(null);
    setAsked(question);
    try {
      const a = await api<AssistantAnswer>("/gear/assistant", {
        method: "POST",
        body: JSON.stringify({ question, ...ctx }),
      });
      setAnswer(a);
      return a;
    } catch (e) {
      setError((e as Error).message || "Something went wrong. Please try again.");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setAnswer(null);
    setError(null);
    setAsked(null);
  }, []);

  return { configured, loading, answer, error, asked, ask, reset };
}
