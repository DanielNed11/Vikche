function normalizeText(value: string | undefined | null) {
  return value?.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() ?? "";
}

export function normalizeDiscountCode(value: string | undefined | null) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const token = normalized
    .replace(
      /^(?:(?:promo(?:tional)?|discount|coupon)\s+code|code|код)\s*[:\-]?\s*/i,
      "",
    )
    .replace(/^(?:with|use)\s+code\s+/i, "")
    .replace(/^(?:с|със)\s+код\s+/i, "")
    .replace(/^(?:използвай(?:те)?|ползвай(?:те)?)\s+код\s+/i, "")
    .replace(/^[`"'“„'«»]+|[`"'”’'«».,;:!?]+$/g, "")
    .trim();

  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/.test(token)) {
    return null;
  }

  return token.toUpperCase();
}

export function extractDiscountCodeFromText(value: string | undefined | null) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const patterns = [
    /\b(?:promo(?:tional)?|discount|coupon)\s+code\s*[:\-]?\s*["'“„]?([A-Za-z0-9][A-Za-z0-9_-]{1,31})\b/i,
    /\b(?:with|use)\s+code\s+["'“„]?([A-Za-z0-9][A-Za-z0-9_-]{1,31})\b/i,
    /(?:^|\s)(?:с|със)\s+код\s+["'“„]?([A-Za-z0-9][A-Za-z0-9_-]{1,31})\b/i,
    /(?:^|\s)(?:използвай(?:те)?|ползвай(?:те)?)\s+код\s+["'“„]?([A-Za-z0-9][A-Za-z0-9_-]{1,31})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = normalizeDiscountCode(match?.[1]);

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

export function extractDiscountCodeFromHtml(value: string | undefined | null) {
  const html = normalizeText(value);

  if (!html) {
    return null;
  }

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return extractDiscountCodeFromText(text);
}
