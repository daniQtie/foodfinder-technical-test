const PREMIUM_STATUSES = new Set(["active"]);

export const hasPremiumAccess = (status: string | null | undefined): boolean =>
  typeof status === "string" && PREMIUM_STATUSES.has(status);
