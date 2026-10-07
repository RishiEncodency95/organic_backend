import { env } from "../config/env";

/**
 * Tells the website (frontend app/api/revalidate) to drop its cached pages so an admin
 * change shows up immediately. Fire-and-forget: never throws and never delays the admin
 * response. Skipped when FRONTEND_URL / REVALIDATE_SECRET are not configured.
 */
export const revalidateWebsite = (): void => {
  const baseUrl = env.FRONTEND_URL?.replace(/\/+$/, "");
  const secret = env.REVALIDATE_SECRET;
  if (!baseUrl || !secret) return;

  fetch(`${baseUrl}/api/revalidate`, {
    method: "POST",
    headers: { "x-revalidate-secret": secret },
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => {
      if (!res.ok) console.warn(`[revalidateWebsite] website responded ${res.status}`);
    })
    .catch((err) => console.warn("[revalidateWebsite] failed:", err?.message || err));
};
