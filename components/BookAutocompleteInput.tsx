'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// ── All 66 canonical Bible book names ────────────────────────────────────────
export const BIBLE_BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy',
  'Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings',
  '1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther',
  'Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon',
  'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel',
  'Hosea','Joel','Amos','Obadiah','Jonah','Micah',
  'Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
  'Matthew','Mark','Luke','John',
  'Acts','Romans',
  '1 Corinthians','2 Corinthians','Galatians','Ephesians',
  'Philippians','Colossians','1 Thessalonians','2 Thessalonians',
  '1 Timothy','2 Timothy','Titus','Philemon',
  'Hebrews','James',
  '1 Peter','2 Peter','1 John','2 John','3 John',
  'Jude','Revelation',
];

// Common abbreviation aliases → canonical name
const ALIASES: Record<string, string> = {
  gen: 'Genesis', ex: 'Exodus', exo: 'Exodus', lev: 'Leviticus',
  num: 'Numbers', deut: 'Deuteronomy', deu: 'Deuteronomy',
  josh: 'Joshua', jos: 'Joshua', judg: 'Judges', jdg: 'Judges',
  ruth: 'Ruth', rut: 'Ruth',
  '1sam': '1 Samuel', '2sam': '2 Samuel', '1sa': '1 Samuel', '2sa': '2 Samuel',
  '1ki': '1 Kings', '2ki': '2 Kings', '1kgs': '1 Kings', '2kgs': '2 Kings',
  '1chr': '1 Chronicles', '2chr': '2 Chronicles', '1ch': '1 Chronicles', '2ch': '2 Chronicles',
  ezr: 'Ezra', neh: 'Nehemiah', est: 'Esther', esth: 'Esther',
  job: 'Job', ps: 'Psalms', psa: 'Psalms', psalm: 'Psalms',
  prov: 'Proverbs', pro: 'Proverbs', eccl: 'Ecclesiastes', ecc: 'Ecclesiastes',
  song: 'Song of Solomon', sos: 'Song of Solomon', ss: 'Song of Solomon',
  isa: 'Isaiah', jer: 'Jeremiah', lam: 'Lamentations',
  ezek: 'Ezekiel', eze: 'Ezekiel', dan: 'Daniel',
  hos: 'Hosea', joel: 'Joel', amos: 'Amos', obad: 'Obadiah',
  jon: 'Jonah', mic: 'Micah', nah: 'Nahum', hab: 'Habakkuk',
  zeph: 'Zephaniah', zep: 'Zephaniah', hag: 'Haggai',
  zech: 'Zechariah', zec: 'Zechariah', mal: 'Malachi',
  matt: 'Matthew', mat: 'Matthew', mt: 'Matthew',
  mark: 'Mark', mrk: 'Mark', mk: 'Mark',
  luke: 'Luke', luk: 'Luke', lk: 'Luke',
  john: 'John', jn: 'John', joh: 'John',
  acts: 'Acts', act: 'Acts',
  rom: 'Romans', ro: 'Romans',
  '1cor': '1 Corinthians', '2cor': '2 Corinthians',
  '1co': '1 Corinthians', '2co': '2 Corinthians',
  gal: 'Galatians', eph: 'Ephesians',
  phil: 'Philippians', php: 'Philippians', phi: 'Philippians',
  col: 'Colossians',
  '1thess': '1 Thessalonians', '2thess': '2 Thessalonians',
  '1th': '1 Thessalonians', '2th': '2 Thessalonians',
  '1tim': '1 Timothy', '2tim': '2 Timothy',
  '1ti': '1 Timothy', '2ti': '2 Timothy',
  tit: 'Titus', phm: 'Philemon',
  heb: 'Hebrews', jas: 'James', jam: 'James',
  '1pet': '1 Peter', '2pet': '2 Peter', '1pe': '1 Peter', '2pe': '2 Peter',
  '1jn': '1 John', '2jn': '2 John', '3jn': '3 John',
  '1john': '1 John', '2john': '2 John', '3john': '3 John',
  jude: 'Jude', rev: 'Revelation', re: 'Revelation',
};

function getBookSuggestions(raw: string): string[] {
  // Only suggest when still typing the book portion (no colon yet means no verse typed)
  if (raw.includes(':')) return [];

  // Strip trailing chapter digits to isolate the book portion
  const bookPart = raw.replace(/\s*\d+[\d\s:–\-]*$/, '').trim();
  if (!bookPart) return [];

  const lower = bookPart.toLowerCase().replace(/\s+/g, '');

  // 1. Alias match (e.g. "ps" → "Psalms")
  const aliasMatch = ALIASES[lower];
  if (aliasMatch) return [aliasMatch];

  // 2. Prefix match on canonical names
  const prefixMatches = BIBLE_BOOKS.filter((b) =>
    b.toLowerCase().startsWith(bookPart.toLowerCase())
  );
  if (prefixMatches.length) return prefixMatches.slice(0, 6);

  // 3. Contains match (fallback)
  return BIBLE_BOOKS.filter((b) =>
    b.toLowerCase().includes(lower)
  ).slice(0, 6);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface BookAutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
}

/**
 * A verse-reference text input with Bible book autocomplete dropdown.
 * Drop-in replacement for a plain <input> — controls the value externally.
 */
export default function BookAutocompleteInput({
  id,
  value,
  onChange,
  onSubmit,
  placeholder = 'e.g. John 3:16 · Romans 8:28-39 · Psalm 23',
  className = 'search-input',
}: BookAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const s = getBookSuggestions(value);
    setSuggestions(s);
    setActiveIdx(-1);
    setOpen(s.length > 0);
  }, [value]);

  const applyBook = useCallback(
    (book: string) => {
      // Keep any chapter/verse suffix the user typed
      const suffix = value.replace(/^[^0-9:–\-]*/, '').trim();
      const newVal = suffix ? `${book} ${suffix}` : `${book} `;
      onChange(newVal);
      setOpen(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const len = newVal.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }, 0);
    },
    [value, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter') onSubmit?.();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0) {
        e.preventDefault();
        applyBook(suggestions[activeIdx]);
      } else {
        setOpen(false);
        onSubmit?.();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      applyBook(suggestions[activeIdx >= 0 ? activeIdx : 0]);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const item = listRef.current.children[activeIdx] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  return (
    <div className="search-input-wrap">
      <input
        ref={inputRef}
        id={id}
        className={className}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-haspopup="listbox"
      />

      {open && suggestions.length > 0 && (
        <ul
          ref={listRef}
          className="book-suggestions"
          role="listbox"
          aria-label="Bible book suggestions"
        >
          {suggestions.map((book, i) => (
            <li
              key={book}
              role="option"
              aria-selected={i === activeIdx}
              className={`book-suggestion-item${i === activeIdx ? ' active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); applyBook(book); }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              {book}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
