/**
 * ssmlBuilder.ts
 *
 * Builds SSML for ElevenLabs TTS with proper pacing for the Builder Method:
 *  - Say the phrase at a slightly measured pace
 *  - Pause between repetitions (configurable)
 *  - Optional "lead-in" to signal the listener before each repeat
 *
 * ElevenLabs SSML notes:
 *  - enable_ssml_parsing: true must be set in the API call
 *  - <break time="Xs"/> max = 3s
 *  - Use eleven_multilingual_v2 (NOT eleven_v3, which uses different tags)
 */

export interface PacingOptions {
  /** Pause between each repetition in milliseconds (max 3000) */
  pauseBetweenMs: number;
  /** Overall speech rate: 0.7 (slow/deliberate) to 1.2 (brisk). Default 0.85 */
  speed: number;
  /** If true, adds a very brief breath-pause mid-phrase at natural comma points */
  naturalBreaths: boolean;
}

const DEFAULT_PACING: PacingOptions = {
  pauseBetweenMs: 1500,
  speed: 0.85,
  naturalBreaths: true,
};

/**
 * Sanitize text for SSML — escape XML special chars.
 */
function ssmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Adds short natural breath pauses at comma/semicolon points within a phrase.
 * Keeps it subtle — 300ms — just enough to breathe, not to sound choppy.
 */
function addNaturalBreaths(text: string): string {
  // After commas and semicolons, insert a short breath
  return text
    .replace(/,\s*/g, ', <break time="300ms"/> ')
    .replace(/;\s*/g, '; <break time="400ms"/> ')
    .replace(/—\s*/g, '— <break time="350ms"/> ');
}

/**
 * Builds a full SSML document with:
 *  - The phrase repeated `repeatCount` times
 *  - Configurable pause between each repetition
 *  - Natural breath pauses within the phrase (optional)
 *  - Controlled speed via <prosody rate>
 *
 * Example output for repeatCount=3, pauseMs=1500:
 *  <speak>
 *    <prosody rate="slow">
 *      For God so loved the world<break time="1500ms"/>
 *      For God so loved the world<break time="1500ms"/>
 *      For God so loved the world
 *    </prosody>
 *  </speak>
 */
export function buildRepeatedSSML(
  phraseText: string,
  repeatCount: number,
  options: Partial<PacingOptions> = {}
): string {
  const opts = { ...DEFAULT_PACING, ...options };

  // Clamp pause to ElevenLabs max of 3000ms
  const pauseMs = Math.min(opts.pauseBetweenMs, 3000);
  const breakTag = `<break time="${pauseMs}ms"/>`;

  // Escape and optionally add breath breaks
  let processedText = ssmlEscape(phraseText);
  if (opts.naturalBreaths) {
    processedText = addNaturalBreaths(processedText);
  }

  // Map speed number to SSML prosody rate
  // ElevenLabs supports numeric rates or keywords: x-slow, slow, medium, fast, x-fast
  const rateAttr = opts.speed <= 0.75 ? 'x-slow'
    : opts.speed <= 0.88 ? 'slow'
    : opts.speed <= 1.05 ? 'medium'
    : opts.speed <= 1.15 ? 'fast'
    : 'x-fast';

  // Build repetitions joined by pause breaks
  const repetitions = Array(repeatCount).fill(processedText).join(` ${breakTag} `);

  return `<speak><prosody rate="${rateAttr}">${repetitions}</prosody></speak>`;
}

/**
 * For single playback (no repetition) — just a well-paced reading.
 */
export function buildSingleSSML(
  phraseText: string,
  options: Partial<PacingOptions> = {}
): string {
  return buildRepeatedSSML(phraseText, 1, options);
}

/**
 * Generate a stable string cache key for a given phrase + settings combo.
 * Used so the same phrase+voice combo only hits ElevenLabs once.
 */
export function buildCacheKey(params: {
  voiceId: string;
  ssml: string;
  speed: number;
}): string {
  // Simple deterministic key — concatenate and encode
  return `${params.voiceId}::${params.speed}::${params.ssml}`;
}
