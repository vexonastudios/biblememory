'use client';

import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/lib/store/settingsStore';
import Link from 'next/link';

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  gender: string;
  accent: string;
  age: string;
}

export default function SettingsPage() {
  const {
    elevenLabsApiKey, setElevenLabsApiKey,
    voiceId, setVoiceId,
    repeatCount, setRepeatCount,
    translation, setTranslation,
    matchThreshold, setMatchThreshold,
    theme, setTheme,
  } = useSettingsStore();

  const [apiKeyInput, setApiKeyInput] = useState(elevenLabsApiKey);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setElevenLabsApiKey(apiKeyInput);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const loadVoices = async () => {
    const key = apiKeyInput || elevenLabsApiKey;
    if (!key) { setVoiceError('Enter your API key first.'); return; }
    setVoiceLoading(true);
    setVoiceError('');
    try {
      const res = await fetch(`/api/voices?apiKey=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error('Failed to fetch voices');
      const data = await res.json();
      setVoices(data.voices || []);
    } catch (e: any) {
      setVoiceError(e.message);
    } finally {
      setVoiceLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <Link href="/" className="back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </Link>
        <h1 className="settings-title">Settings</h1>
      </header>

      <div className="settings-body">
        {/* API Key */}
        <section className="settings-section">
          <h2 className="section-heading">ElevenLabs API Key</h2>
          <p className="section-desc">
            Get a free key at{' '}
            <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" className="ext-link">
              elevenlabs.io
            </a>
            . Your key is stored locally and never sent to any server except ElevenLabs.
          </p>
          <div className="api-key-row">
            <input
              id="api-key-input"
              type="password"
              className="settings-input"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
            />
            <button id="save-key-btn" className="save-btn" onClick={handleSave}>
              {saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <button
            id="load-voices-btn"
            className="load-voices-btn"
            onClick={loadVoices}
            disabled={voiceLoading}
          >
            {voiceLoading ? 'Loading voices…' : 'Load voices from ElevenLabs'}
          </button>
          {voiceError && <p className="settings-error">{voiceError}</p>}
        </section>

        {/* Voice */}
        <section className="settings-section">
          <h2 className="section-heading">Voice</h2>
          {voices.length === 0 ? (
            <p className="section-desc">Load voices above to choose. Default: Sarah (warm, clear).</p>
          ) : (
            <div className="voice-grid">
              {voices.map((v) => (
                <button
                  key={v.voice_id}
                  id={`voice-${v.voice_id}`}
                  className={`voice-card ${voiceId === v.voice_id ? 'voice-selected' : ''}`}
                  onClick={() => setVoiceId(v.voice_id)}
                >
                  <span className="voice-name">{v.name}</span>
                  <span className="voice-meta">{[v.gender, v.accent, v.age].filter(Boolean).join(' · ')}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Repeat count */}
        <section className="settings-section">
          <h2 className="section-heading">Repeat Count</h2>
          <p className="section-desc">
            How many times ElevenLabs reads each phrase cluster before your mic opens.
          </p>
          <div className="slider-row">
            <input
              id="repeat-count-slider"
              type="range"
              min={1} max={7} step={1}
              value={repeatCount}
              onChange={(e) => setRepeatCount(Number(e.target.value))}
              className="settings-slider"
            />
            <span className="slider-value">{repeatCount}×</span>
          </div>
        </section>

        {/* Match threshold */}
        <section className="settings-section">
          <h2 className="section-heading">Match Sensitivity</h2>
          <p className="section-desc">
            How closely your speech must match before you advance. Lower = more lenient.
          </p>
          <div className="slider-row">
            <input
              id="match-threshold-slider"
              type="range"
              min={0.5} max={0.95} step={0.05}
              value={matchThreshold}
              onChange={(e) => setMatchThreshold(Number(e.target.value))}
              className="settings-slider"
            />
            <span className="slider-value">{Math.round(matchThreshold * 100)}%</span>
          </div>
        </section>

        {/* Default translation */}
        <section className="settings-section">
          <h2 className="section-heading">Default Translation</h2>
          <div className="trans-toggle">
            {(['BSB', 'KJV'] as const).map((t) => (
              <button
                key={t}
                id={`trans-${t}`}
                className={`trans-btn ${translation === t ? 'trans-active' : ''}`}
                onClick={() => setTranslation(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="section-desc trans-note">
            BSB (Berean Standard Bible) — modern, clear, fully public domain.<br/>
            KJV (King James Version) — traditional, public domain.
          </p>
        </section>

        {/* App Theme */}
        <section className="settings-section">
          <h2 className="section-heading">App Theme</h2>
          <div className="trans-toggle">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                id={`theme-${t}`}
                className={`trans-btn ${theme === t ? 'trans-active' : ''}`}
                onClick={() => setTheme(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <p className="section-desc">
            Choose light theme, dark theme, or sync with your system theme settings.
          </p>
        </section>
      </div>
    </div>
  );
}
