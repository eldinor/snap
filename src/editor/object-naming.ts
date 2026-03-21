function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function stripLegacyCopySuffixes(value: string) {
  let next = normalizeWhitespace(value);
  while (/\s+copy$/iu.test(next)) {
    next = next.replace(/\s+copy$/iu, "").trim();
  }
  return next;
}

export function splitSceneObjectName(value: string) {
  const cleaned = stripLegacyCopySuffixes(value);
  const match = /^(.*?)(?:\s+(\d+))?$/u.exec(cleaned);
  const base = normalizeWhitespace(match?.[1] ?? cleaned);
  const index = match?.[2] ? Number(match[2]) : null;
  return {
    base,
    index: Number.isFinite(index) ? index : null,
  };
}

export function deriveSceneObjectNameBase(sourceName: string, fallbackBase: string) {
  const { base } = splitSceneObjectName(sourceName);
  return base || normalizeWhitespace(fallbackBase);
}

export function normalizeSceneObjectName(value: string, fallbackBase: string) {
  const { base, index } = splitSceneObjectName(value);
  const normalizedBase = base || normalizeWhitespace(fallbackBase);
  return index ? `${normalizedBase} ${index}` : normalizedBase;
}

export function createSequentialSceneObjectName(baseName: string, existingNames: Iterable<string>) {
  const normalizedBase = normalizeWhitespace(baseName);
  const targetBase = normalizedBase.toLowerCase();
  let maxIndex = 0;

  for (const existingName of existingNames) {
    const { base, index } = splitSceneObjectName(existingName);
    if (base.toLowerCase() !== targetBase) {
      continue;
    }
    maxIndex = Math.max(maxIndex, index ?? 1);
  }

  return `${normalizedBase} ${Math.max(1, maxIndex + 1)}`;
}
