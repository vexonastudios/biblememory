# Inscribed — Bible Memory App

A PWA for hiding God's Word in your heart.  
Phrase-by-phrase audio repetition + spaced repetition review, powered by ElevenLabs TTS.

## Features

- 📖 **Verse memorization** — search any Bible verse (BSB or KJV) and start a hands-free audio session
- 🔊 **Phrase-by-phrase playback** — verses broken into natural chunks, repeated and accumulated
- 🎙 **Voice recall** — speak the verse aloud; the app scores your accuracy
- 🗂 **Verse library** — saved verses are automatically scheduled for spaced repetition review
- 🌙 **Light/dark/system theme** — flash-free theme switching
- 📱 **Installable PWA** — works offline, add to Home Screen on iOS and Android

## Getting Started

```bash
npm install
npm run dev        # starts on :3002
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ELEVENLABS_API_KEY` | Optional | Server-side TTS key. If set, users don't need to enter their own. |
| `NEXT_PUBLIC_SITE_URL` | Optional | Production URL (e.g. `https://inscribed.app`). Used for SEO metadata and sitemap. |

## Translations

- **BSB** (Berean Standard Bible) — bundled locally at `lib/data/bsb.txt`. No API call needed.
- **KJV** — fetched from an external API at request time.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- [Zustand](https://zustand-demo.pmnd.rs/) — client state (verses, sessions, settings)
- [ElevenLabs](https://elevenlabs.io/) — neural TTS
- Vanilla CSS — no UI framework

## Deployment

Deploy to [Vercel](https://vercel.com). Set `ELEVENLABS_API_KEY` as a server-side environment variable in the Vercel dashboard.
