import { NextRequest, NextResponse } from 'next/server';
import { getLocalBsbVerse, getLocalBsbRange, getLocalBsbChapter, LocalVerse } from '@/lib/bibleParser';

// ── Reference Parsing ─────────────────────────────────────────────────────────

type ParsedRef =
  | { type: 'verse';   book: string; chapter: number; verse: number }
  | { type: 'range';   book: string; chapter: number; startVerse: number; endVerse: number }
  | { type: 'chapter'; book: string; chapter: number };

/**
 * Parses the following reference formats:
 *   "John 3:16"        → single verse
 *   "Romans 8:28-39"   → verse range within a chapter
 *   "Psalm 23"         → entire chapter
 */
function parseReference(ref: string): ParsedRef | null {
  const s = ref.trim();

  // "Book Chapter:Start-End"  e.g. Romans 8:28-39
  const rangeMatch = s.match(/^(.+?)\s+(\d+):(\d+)[–\-](\d+)$/);
  if (rangeMatch) {
    return {
      type: 'range',
      book: rangeMatch[1].trim(),
      chapter: parseInt(rangeMatch[2]),
      startVerse: parseInt(rangeMatch[3]),
      endVerse: parseInt(rangeMatch[4]),
    };
  }

  // "Book Chapter:Verse"  e.g. John 3:16
  const singleMatch = s.match(/^(.+?)\s+(\d+):(\d+)$/);
  if (singleMatch) {
    return {
      type: 'verse',
      book: singleMatch[1].trim(),
      chapter: parseInt(singleMatch[2]),
      verse: parseInt(singleMatch[3]),
    };
  }

  // "Book Chapter"  e.g. Psalm 23  (whole chapter)
  const chapterMatch = s.match(/^(.+?)\s+(\d+)$/);
  if (chapterMatch) {
    return {
      type: 'chapter',
      book: chapterMatch[1].trim(),
      chapter: parseInt(chapterMatch[2]),
    };
  }

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Joins multiple LocalVerse objects into a single passage response. */
function passageResponse(verses: LocalVerse[], translation: string) {
  const first = verses[0];
  const last  = verses[verses.length - 1];

  const reference =
    verses.length === 1
      ? first.reference
      : `${first.book} ${first.chapter}:${first.verse}–${last.verse}`;

  const text = verses.map((v) => v.text).join(' ');

  return NextResponse.json({ reference, text, translation, verseCount: verses.length });
}

/** Normalises a book name for the wldeh CDN key. */
function normalizeBook(book: string): string {
  return book.toLowerCase().replace(/\s+/g, '');
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ref         = searchParams.get('ref');
  const translation = (searchParams.get('translation') || 'BSB').toUpperCase();

  if (!ref) {
    return NextResponse.json({ error: 'Missing ref parameter' }, { status: 400 });
  }

  const parsed = parseReference(ref);
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid reference. Try "John 3:16", "Romans 8:28-39", or "Psalm 23".' },
      { status: 400 },
    );
  }

  // ── BSB — served from local file ──────────────────────────────────────────
  if (translation === 'BSB') {
    let verses: LocalVerse[] | null = null;

    if (parsed.type === 'verse') {
      const v = getLocalBsbVerse(parsed.book, parsed.chapter, parsed.verse);
      if (v) verses = [v];
    } else if (parsed.type === 'range') {
      verses = getLocalBsbRange(parsed.book, parsed.chapter, parsed.startVerse, parsed.endVerse);
    } else {
      verses = getLocalBsbChapter(parsed.book, parsed.chapter);
    }

    if (!verses || verses.length === 0) {
      const hint =
        parsed.type === 'chapter'
          ? `Chapter not found: ${parsed.book} ${parsed.chapter}`
          : `Verse not found: ${ref}`;
      return NextResponse.json({ error: hint }, { status: 404 });
    }

    return passageResponse(verses, 'BSB');
  }

  // ── KJV — fetched from external API ───────────────────────────────────────
  return await fetchKjv(parsed, ref);
}

// ── KJV fetching ──────────────────────────────────────────────────────────────

async function fetchKjv(parsed: ParsedRef, originalRef: string): Promise<NextResponse> {
  const { book, chapter } = parsed;
  const bookAbbr = bookAbbrev(book);
  const url = `https://api.helloao.org/api/KJV/${bookAbbr}/${chapter}`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) {
      return NextResponse.json({ error: `Could not fetch: ${originalRef}` }, { status: 502 });
    }

    const data = await res.json();
    const allVerses: { number: number; verseNumber?: number; text?: string; content?: string }[] =
      data?.chapter?.verses || data?.verses || [];

    if (allVerses.length === 0) {
      return NextResponse.json({ error: `No verses returned for ${originalRef}` }, { status: 404 });
    }

    // Filter to requested range
    let filtered = allVerses;
    if (parsed.type === 'verse') {
      filtered = allVerses.filter((v) => v.number === parsed.verse || v.verseNumber === parsed.verse);
    } else if (parsed.type === 'range') {
      filtered = allVerses.filter((v) => {
        const n = v.number ?? v.verseNumber ?? 0;
        return n >= parsed.startVerse && n <= parsed.endVerse;
      });
    }
    // type === 'chapter' keeps all verses

    if (filtered.length === 0) {
      return NextResponse.json({ error: `Verses not found in ${book} ${chapter}` }, { status: 404 });
    }

    // Build LocalVerse-like objects for passageResponse
    const localVerses: LocalVerse[] = filtered.map((v) => ({
      reference: `${book} ${chapter}:${v.number ?? v.verseNumber}`,
      text: (v.text || v.content || '').trim(),
      book,
      chapter,
      verse: v.number ?? v.verseNumber ?? 0,
    }));

    return passageResponse(localVerses, 'KJV');
  } catch {
    return NextResponse.json({ error: 'Failed to fetch from KJV API' }, { status: 502 });
  }
}

// ── Book abbreviation map (for HelloAO KJV API) ───────────────────────────────

function bookAbbrev(book: string): string {
  const map: Record<string, string> = {
    genesis: 'GEN', exodus: 'EXO', leviticus: 'LEV', numbers: 'NUM', deuteronomy: 'DEU',
    joshua: 'JOS', judges: 'JDG', ruth: 'RUT',
    '1samuel': '1SA', '2samuel': '2SA', '1kings': '1KI', '2kings': '2KI',
    '1chronicles': '1CH', '2chronicles': '2CH', ezra: 'EZR', nehemiah: 'NEH',
    esther: 'EST', job: 'JOB', psalms: 'PSA', psalm: 'PSA',
    proverbs: 'PRO', ecclesiastes: 'ECC', songofsolomon: 'SNG',
    isaiah: 'ISA', jeremiah: 'JER', lamentations: 'LAM', ezekiel: 'EZK',
    daniel: 'DAN', hosea: 'HOS', joel: 'JOL', amos: 'AMO', obadiah: 'OBA',
    jonah: 'JON', micah: 'MIC', nahum: 'NAH', habakkuk: 'HAB',
    zephaniah: 'ZEP', haggai: 'HAG', zechariah: 'ZEC', malachi: 'MAL',
    matthew: 'MAT', mark: 'MRK', luke: 'LUK', john: 'JHN', acts: 'ACT',
    romans: 'ROM', '1corinthians': '1CO', '2corinthians': '2CO',
    galatians: 'GAL', ephesians: 'EPH', philippians: 'PHP', colossians: 'COL',
    '1thessalonians': '1TH', '2thessalonians': '2TH', '1timothy': '1TI', '2timothy': '2TI',
    titus: 'TIT', philemon: 'PHM', hebrews: 'HEB', james: 'JAS',
    '1peter': '1PE', '2peter': '2PE', '1john': '1JN', '2john': '2JN', '3john': '3JN',
    jude: 'JUD', revelation: 'REV',
  };
  const key = normalizeBook(book);
  return map[key] || book.toUpperCase().slice(0, 3);
}
