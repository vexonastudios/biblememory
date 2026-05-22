'use client';

import { create } from 'zustand';
import { Phrase } from '../phraseParser';

export type SessionPhase =
  | 'idle'
  | 'reading'     // TTS is playing
  | 'listening'   // mic is open
  | 'passed'      // phrase matched — brief success flash
  | 'failed'      // match failed — retry
  | 'complete';   // full verse done

export interface SessionState {
  // Verse metadata
  reference: string;          // e.g. "John 3:16"
  fullVerseText: string;
  translation: string;

  // Phrase data
  phrases: Phrase[];
  currentStep: number;        // 0-indexed; which phrase we are on

  // Session status
  phase: SessionPhase;
  loopIndex: number;          // which repeat we are on (0..repeatCount-1)
  transcript: string;         // live mic transcript
  matchScore: number;         // 0–1
  failStreak: number;          // consecutive fails on current step

  // History
  completedVerses: string[];  // references of fully memorised verses

  // Actions
  setVerse: (reference: string, text: string, phrases: Phrase[], translation: string) => void;
  setPhase: (phase: SessionPhase) => void;
  setLoopIndex: (i: number) => void;
  setTranscript: (t: string) => void;
  setMatchScore: (s: number) => void;
  advanceStep: () => void;
  stepBack: () => void;
  incrementFailStreak: () => void;
  resetFailStreak: () => void;
  resetSession: () => void;
  markComplete: () => void;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  reference: '',
  fullVerseText: '',
  translation: '',
  phrases: [],
  currentStep: 0,
  phase: 'idle',
  loopIndex: 0,
  transcript: '',
  matchScore: 0,
  failStreak: 0,
  completedVerses: [],

  setVerse: (reference, text, phrases, translation) =>
    set({
      reference,
      fullVerseText: text,
      phrases,
      translation,
      currentStep: 0,
      phase: 'reading',
      loopIndex: 0,
      transcript: '',
      matchScore: 0,
      failStreak: 0,
    }),

  setPhase: (phase) => set({ phase }),
  setLoopIndex: (i) => set({ loopIndex: i }),
  setTranscript: (t) => set({ transcript: t }),
  setMatchScore: (s) => set({ matchScore: s }),

  advanceStep: () => {
    const { currentStep, phrases } = get();
    if (currentStep < phrases.length - 1) {
      set({ currentStep: currentStep + 1, loopIndex: 0, transcript: '', matchScore: 0, failStreak: 0, phase: 'reading' });
    } else {
      set({ phase: 'complete' });
    }
  },

  stepBack: () => {
    const { currentStep } = get();
    const target = Math.max(0, currentStep - 1);
    set({ currentStep: target, loopIndex: 0, transcript: '', matchScore: 0, failStreak: 0, phase: 'reading' });
  },

  incrementFailStreak: () => set((s) => ({ failStreak: s.failStreak + 1 })),
  resetFailStreak: () => set({ failStreak: 0 }),

  resetSession: () =>
    set({
      reference: '',
      fullVerseText: '',
      phrases: [],
      currentStep: 0,
      phase: 'idle',
      loopIndex: 0,
      transcript: '',
      matchScore: 0,
      failStreak: 0,
    }),

  markComplete: () => {
    const { reference, completedVerses } = get();
    if (!completedVerses.includes(reference)) {
      set({ completedVerses: [...completedVerses, reference] });
    }
  },
}));
