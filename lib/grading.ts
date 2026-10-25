export interface AnswerMatchingConfig {
  unicodeNormalization?: 'NFKC' | 'NFC' | 'NFD' | 'NFKD';
  trimWhitespace?: boolean;
  collapseInternalWhitespace?: boolean;
  caseSensitive?: boolean;
  preservePunctuation?: boolean;
  rule?: string;
}

const INTERNAL_WHITESPACE_REGEX = /\s+/g;
const NON_ALPHANUM_PUNCT_REGEX = /[^\p{L}\p{N}\s]/gu;

export function normalizeAnswer(
  val: string | null | undefined,
  config?: AnswerMatchingConfig | null
): string {
  if (val === null || val === undefined) {
    return '';
  }

  const cfg = config || {};
  const unicodeNorm = cfg.unicodeNormalization ?? 'NFKC';

  let normalized: string;
  try {
    normalized = String(val).normalize(unicodeNorm);
  } catch {
    normalized = String(val).normalize('NFKC');
  }

  if (cfg.trimWhitespace !== false) {
    normalized = normalized.trim();
  }

  if (cfg.collapseInternalWhitespace !== false) {
    normalized = normalized.replace(INTERNAL_WHITESPACE_REGEX, ' ');
  }

  if (!cfg.caseSensitive) {
    normalized = normalized.toLowerCase();
  }

  if (cfg.preservePunctuation === false) {
    normalized = normalized.replace(NON_ALPHANUM_PUNCT_REGEX, '');
  }

  return normalized;
}

export function evaluateBlank(
  submittedAnswer: string | null | undefined,
  acceptedAnswers: readonly string[] | null | undefined,
  matchingConfig?: AnswerMatchingConfig | null
): boolean {
  if (submittedAnswer === null || submittedAnswer === undefined) {
    return false;
  }

  if (!acceptedAnswers || acceptedAnswers.length === 0) {
    return false;
  }

  const normSubmitted = normalizeAnswer(submittedAnswer, matchingConfig);
  if (!normSubmitted) {
    return false;
  }

  for (let i = 0; i < acceptedAnswers.length; i++) {
    const accepted = acceptedAnswers[i];
    if (accepted !== null && accepted !== undefined) {
      const normAccepted = normalizeAnswer(accepted, matchingConfig);
      if (normSubmitted === normAccepted) {
        return true;
      }
    }
  }

  return false;
}
