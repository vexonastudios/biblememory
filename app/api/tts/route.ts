import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * In-memory audio cache.
 * Key  = SHA-256(voiceId + ssml) — content-addressed, user-agnostic
 * Value = ArrayBuffer of the MP3
 *
 * This cache lives per-serverless-instance. Vercel reuses warm instances
 * heavily, so this dramatically reduces ElevenLabs calls in practice.
 * For a fully persistent cross-instance cache, swap this for Vercel KV / Blob.
 */
const audioCache = new Map<string, ArrayBuffer>();

/**
 * Build a stable SHA-256 cache key from the audio content parameters.
 * The API key is intentionally NOT part of the key — the same audio
 * is valid regardless of which key generated it.
 */
function makeCacheKey(voiceId: string, ssml: string, speed: number): string {
  return crypto
    .createHash('sha256')
    .update(`${voiceId}::${speed}::${ssml}`)
    .digest('hex');
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    ssml,           // Pre-built SSML string with repetitions + breaks
    text,           // Fallback plain text (if ssml not provided)
    voiceId,
    apiKey,
    speed = 0.85,   // Speaking rate 0.7–1.2
  } = body;

  const content = ssml || text;
  const apiKeyToUse = apiKey || process.env.ELEVENLABS_API_KEY;

  if (!content || !voiceId || !apiKeyToUse) {
    return NextResponse.json({ error: 'Missing content (ssml/text), voiceId, or apiKey' }, { status: 400 });
  }

  // ── Cache lookup ────────────────────────────────────────────────────────────
  const cacheKey = makeCacheKey(voiceId, content, speed);
  const cached = audioCache.get(cacheKey);

  if (cached) {
    console.log(`[TTS] Cache HIT — key: ${cacheKey.slice(0, 12)}…`);
    return new NextResponse(cached, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': cached.byteLength.toString(),
        'X-Cache': 'HIT',
        // Long-lived CDN cache — content is deterministic
        'Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
      },
    });
  }

  // ── ElevenLabs API call ─────────────────────────────────────────────────────
  const isSSML = !!ssml;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

  console.log(`[TTS] Cache MISS — calling ElevenLabs. SSML=${isSSML}, speed=${speed}`);

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
        enable_ssml_parsing: isSSML,   // Only parse SSML when we sent it
        voice_settings: {
          stability: 0.65,             // Slightly higher = more consistent across repeats
          similarity_boost: 0.85,
          style: 0.15,                 // Lower style = cleaner, less theatrical
          use_speaker_boost: true,
          speed: speed,                // 0.7–1.2 speed control
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

    // ── Store in cache ────────────────────────────────────────────────────────
    // Evict oldest entry if cache grows large (keep ≤ 200 entries ≈ ~50MB)
    if (audioCache.size >= 200) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, audioBuffer);

    console.log(`[TTS] Cached ${Math.round(audioBuffer.byteLength / 1024)}KB → key: ${cacheKey.slice(0, 12)}…`);

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
      },
    });
  } catch (e: any) {
    console.error('[TTS] Fetch error:', e);
    return NextResponse.json({ error: e.message || 'TTS request failed' }, { status: 500 });
  }
}
