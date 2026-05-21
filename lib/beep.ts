/**
 * beep.ts
 * Web Audio API tone generator — no external API, zero latency.
 *
 * Used by Review Mode to give immediate audio feedback on errors.
 */

type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle';

interface BeepOptions {
  frequency?: number;     // Hz
  duration?: number;      // ms
  volume?: number;        // 0–1
  type?: WaveType;
  /** Second tone to play in sequence (for two-tone effects) */
  second?: { frequency: number; duration: number };
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  volume: number,
  type: WaveType,
  startAt: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);

  // Smooth attack and release to avoid clicks
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.01);
  gain.gain.setValueAtTime(volume, startAt + duration / 1000 - 0.03);
  gain.gain.linearRampToValueAtTime(0, startAt + duration / 1000);

  osc.start(startAt);
  osc.stop(startAt + duration / 1000);
}

/**
 * ERROR BEEP — low, harsh buzz to signal a wrong word.
 * Two descending tones: 330Hz → 220Hz (sounds like "nope!")
 */
export function playErrorBeep(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    playTone(ctx, 330, 180, 0.6, 'square', now);
    playTone(ctx, 220, 200, 0.5, 'square', now + 0.18);
  } catch (e) {
    console.warn('Beep failed:', e);
  }
}

/**
 * SUCCESS CHIME — bright, pleasant ascending tones.
 * Used when the user corrects a word or finishes a section.
 */
export function playSuccessChime(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    playTone(ctx, 523, 100, 0.4, 'sine', now);        // C5
    playTone(ctx, 659, 100, 0.4, 'sine', now + 0.10); // E5
    playTone(ctx, 784, 200, 0.45, 'sine', now + 0.20); // G5
  } catch (e) {
    console.warn('Chime failed:', e);
  }
}

/**
 * COMPLETION FANFARE — full chord resolving nicely.
 */
export function playCompletionFanfare(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    playTone(ctx, 523, 150, 0.4, 'sine', now);
    playTone(ctx, 659, 150, 0.4, 'sine', now + 0.15);
    playTone(ctx, 784, 150, 0.4, 'sine', now + 0.30);
    playTone(ctx, 1047, 400, 0.5, 'sine', now + 0.45); // C6
  } catch (e) {
    console.warn('Fanfare failed:', e);
  }
}

/**
 * Soft tick — used when a word is confirmed correct mid-passage.
 */
export function playWordTick(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    playTone(ctx, 880, 40, 0.15, 'sine', now);
  } catch (e) {
    // silent fail — ticks are optional feedback
  }
}
