/**
 * lib/r2.ts — Cloudflare R2 audio cache
 *
 * Uses the S3-compatible API so we can use @aws-sdk/client-s3 from a
 * Vercel serverless function. Credentials come from environment variables:
 *
 *   R2_ACCOUNT_ID         — Cloudflare account ID (from the bucket URL)
 *   R2_ACCESS_KEY_ID      — R2 API token Access Key ID
 *   R2_SECRET_ACCESS_KEY  — R2 API token Secret Access Key
 *   R2_BUCKET_NAME        — bucket name (default: "inscribed")
 *
 * Object key format:
 *   tts/{voiceId}/{speed}/{sha256(text)}.mp3
 *
 * This is intentionally content-addressed and voice/speed scoped so:
 *  - Same text + same voice + same speed → always same key
 *  - Different voice or speed → different key (correct: different audio)
 *  - Multiple users asking for Psalm 23 in Finley/0.85 → one stored object
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import crypto from 'crypto';

// ── Build the R2 S3 client ────────────────────────────────────────────────────

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    // R2 not configured — skip silently
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // Required for Cloudflare R2 — without this the SDK uses virtual-hosted
    // style (bucket.accountid.r2.cloudflarestorage.com) which R2 doesn't support.
    forcePathStyle: true,
  });
}

const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'inscribed';

// ── Key generation ────────────────────────────────────────────────────────────

export function makeR2Key(voiceId: string, speed: number, text: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(text)
    .digest('hex');
  // e.g. tts/fnYMz3F5gMEDGMWcH1ex/0.85/a3f1c2...mp3
  return `tts/${voiceId}/${speed}/${hash}.mp3`;
}

// ── Get ───────────────────────────────────────────────────────────────────────

/**
 * Try to fetch an audio file from R2.
 * Returns ArrayBuffer on hit, null on miss or if R2 is not configured.
 * Never throws.
 */
export async function getAudioFromR2(key: string): Promise<ArrayBuffer | null> {
  const client = getR2Client();
  if (!client) return null;

  try {
    const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
    const res = await client.send(cmd);
    if (!res.Body) return null;

    // Stream to ArrayBuffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      buf.set(chunk, offset);
      offset += chunk.length;
    }
    console.log(`[R2] Cache HIT — ${key}`);
    return buf.buffer;
  } catch (e: any) {
    // NoSuchKey (404) is expected for a miss — everything else is unexpected
    if (e?.name !== 'NoSuchKey' && e?.$metadata?.httpStatusCode !== 404) {
      console.warn('[R2] GetObject error:', e?.message ?? e);
    }
    return null;
  }
}

// ── Put ───────────────────────────────────────────────────────────────────────

/**
 * Upload an audio buffer to R2.
 * Fire-and-forget safe — errors are logged but not re-thrown.
 */
export async function putAudioToR2(key: string, buffer: ArrayBuffer): Promise<void> {
  const client = getR2Client();
  if (!client) return;

  try {
    const cmd = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: 'audio/mpeg',
      // Objects are content-addressed — safe to cache forever
      CacheControl: 'public, max-age=31536000, immutable',
    });
    await client.send(cmd);
    console.log(`[R2] Stored ${Math.round(buffer.byteLength / 1024)}KB → ${key}`);
  } catch (e: any) {
    console.warn('[R2] PutObject error:', e?.message ?? e);
    // Don't throw — a failed write just means we miss the cache this time
  }
}

// ── Existence check (optional, for pre-fetch skipping) ───────────────────────

export async function existsInR2(key: string): Promise<boolean> {
  const client = getR2Client();
  if (!client) return false;
  try {
    await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}
