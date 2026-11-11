/** Shared by the report form (browser) and the server. */
export const REPORT_REASONS = ["scam", "malware", "offensive", "spam", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);
}
