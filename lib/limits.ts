/** Field length limits, shared by the form and the server-side validation. */
export const LIMITS = {
  url: 2000,
  name: 40,
  note: 280,
  question: 120,
  answer: 60,
} as const;
