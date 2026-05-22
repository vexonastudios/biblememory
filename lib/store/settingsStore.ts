'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PresetVoice {
  voice_id: string;
  name: string;
  gender: string;
  accent: string;
  age: string;
}

export const PRESET_VOICES: PresetVoice[] = [
  { voice_id: 'fnYMz3F5gMEDGMWcH1ex', name: 'Finley', gender: 'Male', accent: 'American', age: 'Adult' },
  { voice_id: 'RILOU7YmBhvwJGDGjNmP', name: 'Jane', gender: 'Female', accent: 'American', age: 'Adult' },
  { voice_id: 'mZ8K1MPRiT5wDQaasg3i', name: 'Alexander', gender: 'Male', accent: 'American', age: 'Adult' },
  { voice_id: 'NNl6r8mD7vthiJatiJt1', name: 'Bradford', gender: 'Male', accent: 'American', age: 'Adult' },
];

interface SettingsState {
  elevenLabsApiKey: string;
  voiceId: string;
  repeatCount: number;        // how many times TTS reads before mic opens
  translation: 'BSB' | 'KJV';
  matchThreshold: number;     // 0.0–1.0, how strict the fuzzy match is
  pauseBetweenMs: number;     // ms of silence between repetitions (500–5000)
  pauseMode: 'fixed' | 'echo'; // 'fixed' = pauseBetweenMs; 'echo' = duration of clip just played
  readingSpeed: number;       // TTS speed 0.7–1.2 (0.85 = deliberate)
  theme: 'light' | 'dark' | 'system';
  hasSelectedVoice: boolean;  // Whether the user has confirmed their initial voice
  _hasHydrated: boolean;      // True once zustand/persist has reloaded from localStorage
  setElevenLabsApiKey: (key: string) => void;
  setVoiceId: (id: string) => void;
  setRepeatCount: (count: number) => void;
  setTranslation: (t: 'BSB' | 'KJV') => void;
  setMatchThreshold: (v: number) => void;
  setPauseBetweenMs: (ms: number) => void;
  setPauseMode: (mode: 'fixed' | 'echo') => void;
  setReadingSpeed: (s: number) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setHasSelectedVoice: (selected: boolean) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      elevenLabsApiKey: '',
      voiceId: 'fnYMz3F5gMEDGMWcH1ex', // Finley (Default)
      repeatCount: 3,
      translation: 'BSB',
      matchThreshold: 0.60,             // 60% — forgiving enough for STT mishears
      pauseBetweenMs: 1500,             // 1.5s breath between repeats (fixed mode)
      pauseMode: 'fixed',               // 'fixed' or 'echo' (mirror audio duration)
      readingSpeed: 0.85,               // Slightly slower than normal — deliberate
      theme: 'light',
      hasSelectedVoice: false,
      _hasHydrated: false,
      setElevenLabsApiKey: (key) => set({ elevenLabsApiKey: key }),
      setVoiceId: (id) => set({ voiceId: id }),
      setRepeatCount: (count) => set({ repeatCount: count }),
      setTranslation: (t) => set({ translation: t }),
      setMatchThreshold: (v) => set({ matchThreshold: v }),
      setPauseBetweenMs: (ms) => set({ pauseBetweenMs: ms }),
      setPauseMode: (mode) => set({ pauseMode: mode }),
      setReadingSpeed: (s) => set({ readingSpeed: s }),
      setTheme: (theme) => set({ theme }),
      setHasSelectedVoice: (selected) => set({ hasSelectedVoice: selected }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'bible-memory-settings',
      // Called once localStorage has been read and state merged —
      // flip the flag so the UI knows hydration is complete.
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
      },
    }
  )
);
