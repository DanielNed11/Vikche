import type { ExtractorKind, ScrapeAttemptDraft } from "@/lib/types";

export function failLatestAttempt(
  attempts: ScrapeAttemptDraft[],
  extractor: ExtractorKind,
  message: string,
) {
  const nextAttempts = [...attempts];

  for (let index = nextAttempts.length - 1; index >= 0; index -= 1) {
    if (nextAttempts[index]?.extractor === extractor && nextAttempts[index]?.ok) {
      nextAttempts[index] = {
        extractor,
        ok: false,
        error: message,
      };

      return nextAttempts;
    }
  }

  nextAttempts.push({
    extractor,
    ok: false,
    error: message,
  });

  return nextAttempts;
}
