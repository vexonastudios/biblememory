'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  elevenLabsApiKey: string;
  voiceId: string;
  repeatCount: number;      // how many times TTS reads before mic opens
  translation: 'BSB' | 'KJV';
  matchThreshold: number;   // 0.0–1.0, how strict the fuzzy match is
  setElevenLabsApiKey: (key: string) => void;
  setVoiceId: (id: string) => void;
  setRepeatCount: (count: number) => void;
  setTranslation: (t: 'BSB' | 'KJV') => void;
  setMatchThreshold: (v: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      elevenLabsApiKey: '',
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // ElevenLabs "Sarah" — warm, clear
      repeatCount: 3,
      translation: 'BSB',
      matchThreshold: 0.70,
      setElevenLabsApiKey: (key) => set({ elevenLabsApiKey: key }),
      setVoiceId: (id) => set({ voiceId: id }),
      setRepeatCount: (count) => set({ repeatCount: count }),
      setTranslation: (t) => set({ translation: t }),
      setMatchThreshold: (v) => set({ matchThreshold: v }),
    }),
    { name: 'bible-memory-settings' }
  )
);
