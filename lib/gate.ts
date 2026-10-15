// Shared-password gate for the early rollout (see proxy.ts and app/gate/page.tsx).
export const GATE_COOKIE = "glassing_gate";

// The cookie holds a hash rather than the password; changing SITE_PASSWORD signs everyone out.
export async function gateToken() {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`glassing-gate:${process.env.SITE_PASSWORD}`),
  );
  return Buffer.from(digest).toString("hex");
}
