import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { makeR2Key, getAudioFromR2, putAudioToR2 } from '@/lib/r2';

/**
 * /api/tts — Text-to-Speech via ElevenLabs with 3-tier caching:
 *
 *   Tier 1 — In-process memory (per warm serverless instance, fastest)
 *   Tier 2 — Cloudflare R2 (persistent, cross-instance, cross-user global cache)
 *   Tier 3 — ElevenLabs API (live synthesis, only on true cache miss)
 *
 * Cache key: SHA-256(text) scoped by voiceId + speed
 * Object path: tts/{voiceId}/{speed}/{sha256(text)}.mp3
 *
 * Once Psalm 23 is synthesised in Finley/0.85 by ANY user, every subsequent
 * request for that exact phrase/voice/speed hits R2 and never touches ElevenLabs.
 */

// ── Tier 1: in-process memory cache ──────────────────────────────────────────
const audioCache = new Map<string, ArrayBuffer>();

function makeMemKey(voiceId: string, content: string, speed: number): string {
  return crypto
    .createHash('sha256')
    .update(`${voiceId}::${speed}::${content}`)
    .digest('hex');
}

// ── Rate limiter ──────────────────────────────────────────────────────────────
// Safety net: 60 requests/IP/minute — catches any runaway loops.
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

// ── Helper: build a standard audio response ───────────────────────────────────
function audioResponse(buffer: ArrayBuffer, cacheStatus: string): NextResponse {
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.byteLength.toString(),
      'X-Cache': cacheStatus,
      'Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
    },
  });
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Rate limit check
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  if (!checkRateLimit(ip)) {
    console.warn(`[TTS] Rate limit exceeded for IP: ${ip}`);
    return NextResponse.json(
      { error: 'Too many requests — please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const body = await request.json();
  const {
    ssml,
    text,
    voiceId,
    apiKey,
    speed = 0.85,
  } = body;

  const content = ssml || text;
  const apiKeyToUse = apiKey || process.env.ELEVENLABS_API_KEY;

  if (!content || !voiceId || !apiKeyToUse) {
    return NextResponse.json(
      { error: 'Missing content (ssml/text), voiceId, or apiKey' },
      { status: 400 }
    );
  }

  // ── Tier 1: in-process memory ─────────────────────────────────────────────
  const memKey = makeMemKey(voiceId, content, speed);
  const memHit = audioCache.get(memKey);
  if (memHit) {
    console.log(`[TTS] L1 HIT (memory) — ${memKey.slice(0, 12)}…`);
    return audioResponse(memHit, 'HIT-MEMORY');
  }

  // ── Tier 2: Cloudflare R2 ─────────────────────────────────────────────────
  const r2Key = makeR2Key(voiceId, speed, content);
  const r2Hit = await getAudioFromR2(r2Key);
  if (r2Hit) {
    // Warm the memory cache too so subsequent calls in this instance are free
    if (audioCache.size >= 200) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }
    audioCache.set(memKey, r2Hit);
    return audioResponse(r2Hit, 'HIT-R2');
  }

  // ── Tier 3: ElevenLabs API ────────────────────────────────────────────────
  const isSSML = !!ssml;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

  console.log(`[TTS] L1+L2 MISS — calling ElevenLabs. SSML=${isSSML}, speed=${speed}, r2Key=${r2Key}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKeyToUse,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: content,
        model_id: 'eleven_multilingual_v2',
        enable_ssml_parsing: isSSML,
        voice_settings: {
          stability: 0.65,
          similarity_boost: 0.85,
          style: 0.15,
          use_speaker_boost: true,
          speed,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[TTS] ElevenLabs error:', res.status, errText);
      return NextResponse.json(
        { error: `ElevenLabs error ${res.status}: ${errText}` },
        { status: res.status }
      );
    }

    const audioBuffer = await res.arrayBuffer();

    // Write to R2 (fire-and-forget — don't block the response)
    putAudioToR2(r2Key, audioBuffer).catch(() => {});

    // Warm the in-process memory cache
    if (audioCache.size >= 200) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }
    audioCache.set(memKey, audioBuffer);

    console.log(`[TTS] Synthesised ${Math.round(audioBuffer.byteLength / 1024)}KB → r2Key: ${r2Key}`);

    return audioResponse(audioBuffer, 'MISS');
  } catch (e: any) {
    console.error('[TTS] Fetch error:', e);
    return NextResponse.json({ error: e.message || 'TTS request failed' }, { status: 500 });
  }
}
