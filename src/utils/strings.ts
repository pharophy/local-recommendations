export function normalizeText(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function normalizeRegionLabel(input: string): string {
  const normalized = normalizeWhitespace(input);
  if (!normalized) {
    return normalized;
  }

  const lower = normalized.toLowerCase();
  if (lower.includes('orange county')) {
    return 'Orange County';
  }
  if (lower.includes('los angeles')) {
    return 'Los Angeles';
  }
  if (lower.includes('temecula')) {
    return 'Temecula';
  }
  if (lower.includes('san diego')) {
    return 'San Diego';
  }
  if (lower.includes('out of region')) {
    return 'Out of Region';
  }

  return normalized
    .replace(/\b(first|second|third|fourth|priority|preferred)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function splitListField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
