import rateLimit from "express-rate-limit";

/** General API limiter — generous, protects against runaway clients. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  // Stripe's webhook deliveries all arrive from a small pool of Stripe IPs, so
  // a busy hour could rate-limit BILLING itself: a 429'd event means a paying
  // customer's plan silently never activates. The endpoint is not a DoS risk —
  // it rejects anything without a valid signature — so exempt it here and let
  // signature verification be its gate.
  skip: (req) => req.path === "/billing/webhook",
});

/** Strict limiter for auth endpoints — blunts credential-stuffing / brute force. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait and try again." },
});

/** AI endpoints cost real money per call — cap them tighter than general traffic. */
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You've reached the AI assistant limit for now. Please wait a few minutes." },
});
