export interface AnswerMatchingConfig {
  unicodeNormalization?: 'NFKC' | 'NFC' | 'NFD' | 'NFKD';
  trimWhitespace?: boolean;
  collapseInternalWhitespace?: boolean;
  caseSensitive?: boolean;
  preservePunctuation?: boolean;
  rule?: string;
}

export function normalizeAnswer(
  val: string | null | undefined,
  config?: AnswerMatchingConfig | null
): string {
  if (val === null || val === undefined) {
    return '';
  }

  const cfg = config || {};

  // 1. Unicode normalization (default NFKC)
  const unicodeNorm = cfg.unicodeNormalization ?? 'NFKC';
  let normalized: string;
  try {
    normalized = String(val).normalize(unicodeNorm);
  } catch {
    normalized = String(val).normalize('NFKC');
  }

  // 2. Trim whitespace (default true)
  if (cfg.trimWhitespace !== false) {
    normalized = normalized.trim();
  }

  // 3. Collapse internal whitespace (default true)
  if (cfg.collapseInternalWhitespace !== false) {
    normalized = normalized.replace(/\s+/g, ' ');
  }

  // 4. Case sensitivity (default false -> lowercase)
  if (!cfg.caseSensitive) {
    normalized = normalized.toLowerCase();
  }

  // 5. Punctuation preservation (default true)
  if (cfg.preservePunctuation === false) {
    // Remove punctuation
    normalized = normalized.replace(/[^\p{L}\p{N}\s]/gu, '');
  }

  return normalized;
}

export function evaluateBlank(
  submittedAnswer: string | null | undefined,
  acceptedAnswers: string[],
  matchingConfig?: AnswerMatchingConfig | null
): boolean {
  if (submittedAnswer === null || submittedAnswer === undefined) {
    return false;
  }

  const normSubmitted = normalizeAnswer(submittedAnswer, matchingConfig);
  if (!normSubmitted) {
    return false;
  }

  for (const accepted of acceptedAnswers) {
    const normAccepted = normalizeAnswer(accepted, matchingConfig);
    if (normSubmitted === normAccepted) {
      return true;
    }
  }

  return false;
}
