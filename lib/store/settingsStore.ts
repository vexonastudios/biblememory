'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  elevenLabsApiKey: string;
  voiceId: string;
  repeatCount: number;        // how many times TTS reads before mic opens
  translation: 'BSB' | 'KJV';
  matchThreshold: number;     // 0.0–1.0, how strict the fuzzy match is
  pauseBetweenMs: number;     // ms of silence between repetitions (500–3000)
  readingSpeed: number;       // TTS speed 0.7–1.2 (0.85 = deliberate)
  setElevenLabsApiKey: (key: string) => void;
  setVoiceId: (id: string) => void;
  setRepeatCount: (count: number) => void;
  setTranslation: (t: 'BSB' | 'KJV') => void;
  setMatchThreshold: (v: number) => void;
  setPauseBetweenMs: (ms: number) => void;
  setReadingSpeed: (s: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      elevenLabsApiKey: '',
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // ElevenLabs "Sarah" — warm, clear
      repeatCount: 3,
      translation: 'BSB',
      matchThreshold: 0.70,
      pauseBetweenMs: 1500,             // 1.5s breath between repeats
      readingSpeed: 0.85,               // Slightly slower than normal — deliberate
      setElevenLabsApiKey: (key) => set({ elevenLabsApiKey: key }),
      setVoiceId: (id) => set({ voiceId: id }),
      setRepeatCount: (count) => set({ repeatCount: count }),
      setTranslation: (t) => set({ translation: t }),
      setMatchThreshold: (v) => set({ matchThreshold: v }),
      setPauseBetweenMs: (ms) => set({ pauseBetweenMs: ms }),
      setReadingSpeed: (s) => set({ readingSpeed: s }),
    }),
    { name: 'bible-memory-settings' }
  )
);
