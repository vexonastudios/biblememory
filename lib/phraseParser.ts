/**
 * phraseParser.ts
 * Splits a Bible verse into natural, speakable phrases for the Builder Method.
 */

export interface Phrase {
  id: number;
  text: string;
}

// Patterns that indicate phrase boundaries
const SPLIT_PATTERNS = [
  // Hard splits: punctuation boundaries
  /(?<=[^,;:\-])[,;]\s*/,
  /(?<=\w):\s+(?=[a-z])/,       // colon followed by lowercase
  /\s+—\s+/,                    // em dash

  // Soft splits: conjunctions that start new clauses
  /\s+(?=\bthat\b)/,
  /\s+(?=\bbut\b)/,
  /\s+(?=\bfor\b)/,
  /\s+(?=\btherefore\b)/,
  /\s+(?=\bso that\b)/,
  /\s+(?=\bso\b)/,
  /\s+(?=\band\b)/,
  /\s+(?=\bor\b)/,
  /\s+(?=\bif\b)/,
  /\s+(?=\bwhen\b)/,
  /\s+(?=\bwherefore\b)/,
];

const MIN_PHRASE_WORDS = 3;
const MAX_PHRASE_WORDS = 12;

/**
 * Splits a verse text into clean, speakable phrases.
 */
export function parseVerseIntoPhrases(verseText: string): Phrase[] {
  // Normalize whitespace
  const text = verseText.trim().replace(/\s+/g, ' ');

  // First pass: split on comma/semicolon boundaries
  let parts = splitOnPunctuation(text);

  // Second pass: split long parts on conjunctions
  parts = parts.flatMap((part) => splitLongPart(part));

  // Third pass: merge very short parts with the next
  parts = mergeShortParts(parts);

  // Clean up and return
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((text, i) => ({ id: i + 1, text }));
}

function splitOnPunctuation(text: string): string[] {
  // Split on commas and semicolons, keeping a clean structure
  const result: string[] = [];
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ((ch === ',' || ch === ';') && current.trim().split(' ').length >= MIN_PHRASE_WORDS) {
      result.push(current.trim());
      current = '';
      // Skip trailing space
      while (i + 1 < text.length && text[i + 1] === ' ') i++;
    } else {
      current += ch;
    }
  }

  if (current.trim()) result.push(current.trim());
  return result;
}

function splitLongPart(text: string): string[] {
  const words = text.split(' ');
  if (words.length <= MAX_PHRASE_WORDS) return [text];

  // Try to split on a conjunction in the middle
  const conjunctions = ['that', 'but', 'for', 'and', 'so', 'or', 'if', 'when', 'therefore', 'wherefore', 'which'];
  const mid = Math.floor(words.length / 2);

  // Search around the midpoint for a conjunction to split on
  for (let radius = 0; radius <= mid; radius++) {
    for (const offset of [radius, -radius]) {
      const idx = mid + offset;
      if (idx > 0 && idx < words.length && conjunctions.includes(words[idx].toLowerCase())) {
        const left = words.slice(0, idx).join(' ');
        const right = words.slice(idx).join(' ');
        if (left.split(' ').length >= MIN_PHRASE_WORDS && right.split(' ').length >= MIN_PHRASE_WORDS) {
          return [left, right];
        }
      }
    }
  }

  // Fallback: split at midpoint
  const left = words.slice(0, mid).join(' ');
  const right = words.slice(mid).join(' ');
  return [left, right];
}

function mergeShortParts(parts: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const wordCount = parts[i].trim().split(' ').length;
    if (wordCount < MIN_PHRASE_WORDS && result.length > 0) {
      // Merge with previous
      result[result.length - 1] += ', ' + parts[i].trim();
    } else {
      result.push(parts[i]);
    }
  }
  return result;
}

/**
 * Builds accumulated phrase strings for each step of the Builder Method.
 * Step 1 = phrase 1 only
 * Step 2 = phrases 1+2
 * etc.
 */
export function buildAccumulatedPhrases(phrases: Phrase[]): string[] {
  return phrases.map((_, i) =>
    phrases
      .slice(0, i + 1)
      .map((p) => p.text)
      .join(', ')
  );
}
