import { NextRequest, NextResponse } from 'next/server';
import { getLocalBsbVerse } from '@/lib/bibleParser';

const BIBLE_TRANSLATIONS: Record<string, string> = {
  BSB: 'BSB',
  KJV: 'KJV',
};

// Map book names to wldeh bible-api format
function normalizeBook(book: string): string {
  return book.toLowerCase().replace(/\s+/g, '');
}

// Parse reference like "John 3:16" or "1 Corinthians 13:4"
function parseReference(ref: string): { book: string; chapter: number; verse: number } | null {
  const match = ref.match(/^(.+?)\s+(\d+):(\d+)$/);
  if (!match) return null;
  return {
    book: match[1].trim(),
    chapter: parseInt(match[2]),
    verse: parseInt(match[3]),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get('ref');
  const translation = searchParams.get('translation') || 'BSB';

  if (!ref) {
    return NextResponse.json({ error: 'Missing ref parameter' }, { status: 400 });
  }

  const parsed = parseReference(ref);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid reference format. Use "Book Chapter:Verse" e.g. "John 3:16"' }, { status: 400 });
  }

  const { book, chapter, verse } = parsed;

  // Handle local BSB verses
  if (translation.toUpperCase() === 'BSB') {
    const localVerse = getLocalBsbVerse(book, chapter, verse);
    if (localVerse) {
      return NextResponse.json({
        reference: localVerse.reference,
        text: localVerse.text,
        translation: 'BSB',
        book: localVerse.book,
        chapter: localVerse.chapter,
        verse: localVerse.verse,
      });
    } else {
      return NextResponse.json({ error: `Verse not found: ${book} ${chapter}:${verse}` }, { status: 404 });
    }
  }

  const bookKey = normalizeBook(book);
  const transKey = translation.toUpperCase() === 'KJV' ? 'en-kjv' : 'en-bsb';

  // Try wldeh CDN API (no key needed, public domain)
  const url = `https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/${transKey}/books/${bookKey}/chapters/${chapter}/verses/${verse}.json`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
    if (!res.ok) {
      // Try HelloAO fallback
      return await fetchHelloAO(book, chapter, verse, translation);
    }

    const data = await res.json();
    const text: string = data.text || data.verse || '';

    if (!text) {
      return await fetchHelloAO(book, chapter, verse, translation);
    }

    return NextResponse.json({
      reference: ref,
      text: text.trim(),
      translation: translation.toUpperCase(),
      book,
      chapter,
      verse,
    });
  } catch (e) {
    return await fetchHelloAO(book, chapter, verse, translation);
  }
}

async function fetchHelloAO(book: string, chapter: number, verse: number, translation: string) {
  // HelloAO API format
  const transCode = translation.toUpperCase() === 'KJV' ? 'KJV' : 'BSB';
  const url = `https://api.helloao.org/api/${transCode}/${bookAbbrev(book)}/${chapter}`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) {
      return NextResponse.json({ error: `Could not fetch verse: ${book} ${chapter}:${verse}` }, { status: 502 });
    }
    const data = await res.json();
    // HelloAO returns { chapter: { verses: [...] } }
    const verses = data?.chapter?.verses || data?.verses || [];
    const found = verses.find((v: any) => v.number === verse || v.verseNumber === verse);
    if (!found) {
      return NextResponse.json({ error: `Verse ${verse} not found in ${book} ${chapter}` }, { status: 404 });
    }
    const text = found.text || found.content || '';
    return NextResponse.json({
      reference: `${book} ${chapter}:${verse}`,
      text: text.trim(),
      translation: transCode,
      book,
      chapter,
      verse,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch from both Bible APIs' }, { status: 502 });
  }
}

function bookAbbrev(book: string): string {
  const abbrevMap: Record<string, string> = {
    genesis: 'GEN', exodus: 'EXO', leviticus: 'LEV', numbers: 'NUM', deuteronomy: 'DEU',
    joshua: 'JOS', judges: 'JDG', ruth: 'RUT',
    '1samuel': '1SA', '2samuel': '2SA', '1kings': '1KI', '2kings': '2KI',
    '1chronicles': '1CH', '2chronicles': '2CH', ezra: 'EZR', nehemiah: 'NEH',
    esther: 'EST', job: 'JOB', psalms: 'PSA', psalm: 'PSA',
    proverbs: 'PRO', ecclesiastes: 'ECC', 'songofsolomon': 'SNG',
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
  const key = book.toLowerCase().replace(/\s+/g, '');
  return abbrevMap[key] || book.toUpperCase().slice(0, 3);
}
