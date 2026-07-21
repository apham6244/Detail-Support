// Thin fetch client for the backend API. Attaches the Bearer token (set at
// login) and normalizes error responses into thrown Errors.

const BASE = import.meta.env.VITE_API_URL ?? "";

/** Whether an API base URL is configured. If not, the app stays in demo mode. */
export const apiConfigured = Boolean(BASE);

const TOKEN_KEY = "amei-token";
let token: string | null =
  typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

export function getToken(): string | null {
  return token;
}

export function setToken(next: string | null): void {
  token = next;
  if (next) localStorage.setItem(TOKEN_KEY, next);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch {
    // Network failure (server down, DNS, offline) — fetch() rejects here.
    throw new Error(
      "Connection error — couldn't reach the server. It may be offline or the API URL may be wrong."
    );
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = body?.error ?? `Request failed (${res.status})`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body as T;
}
