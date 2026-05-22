'use client';

import { useEffect, useState } from 'react';
import { useSettingsStore, PRESET_VOICES } from '@/lib/store/settingsStore';
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
  const [serverHasKey, setServerHasKey] = useState(false);

  // Preview state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setServerHasKey(data.hasApiKey))
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [audioElement]);

  const handleSave = () => {
    setElevenLabsApiKey(apiKeyInput);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePlayPreview = async (vId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioElement) {
      audioElement.pause();
      setPlayingId(null);
    }
    if (playingId === vId) {
      setPlayingId(null);
      return;
    }
    setPreviewLoadingId(vId);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: "I have hidden Your word in my heart that I might not sin against You.",
          voiceId: vId,
          speed: 0.85
        })
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      setAudioElement(audio);
      setPlayingId(vId);
      setPreviewLoadingId(null);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPlayingId(null);
      };
      audio.play().catch(() => setPlayingId(null));
    } catch {
      setPreviewLoadingId(null);
    }
  };

  const loadVoices = async () => {
    const key = apiKeyInput || elevenLabsApiKey;
    if (!key && !serverHasKey) { setVoiceError('Enter your API key first.'); return; }
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
              placeholder={serverHasKey ? "Optional (Configured on server)" : "sk-..."}
              autoComplete="off"
            />
            <button id="save-key-btn" className="save-btn" onClick={handleSave}>
              {saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          {serverHasKey && <p className="server-key-note" style={{ color: 'var(--gold)', fontSize: '0.85rem', marginTop: '0.4rem', fontWeight: 500 }}>✓ ElevenLabs API Key is configured on the server.</p>}
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
          <p className="section-desc">
            Choose a preset narrator voice below, or load your custom ElevenLabs voices.
          </p>
          
          <h3 className="section-subheading" style={{ fontSize: '0.9rem', fontWeight: 600, margin: '16px 0 8px', color: 'var(--text-secondary)' }}>Preset Voices</h3>
          <div className="voice-grid">
            {PRESET_VOICES.map((v) => (
              <div
                key={v.voice_id}
                id={`voice-${v.voice_id}`}
                className={`voice-card ${voiceId === v.voice_id ? 'voice-selected' : ''}`}
                onClick={() => setVoiceId(v.voice_id)}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setVoiceId(v.voice_id); }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span className="voice-name">{v.name}</span>
                  <button
                    onClick={(e) => handlePlayPreview(v.voice_id, e)}
                    className="preview-play-btn"
                    title="Listen to preview"
                    aria-label={`Listen to preview of ${v.name}`}
                    style={{
                      padding: '4px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: playingId === v.voice_id ? 'var(--gold)' : 'rgba(var(--gold-rgb), 0.08)',
                      color: playingId === v.voice_id ? '#fff' : 'var(--gold)',
                      border: 'none',
                      cursor: 'pointer',
                      width: '24px',
                      height: '24px',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {previewLoadingId === v.voice_id ? (
                      <span className="spinner-small"></span>
                    ) : playingId === v.voice_id ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                        <rect x="6" y="6" width="12" height="12" rx="1" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <span className="voice-meta">{[v.gender, v.accent, v.age].filter(Boolean).join(' · ')}</span>
              </div>
            ))}
          </div>

          {voices.length > 0 && (
            <>
              <h3 className="section-subheading" style={{ fontSize: '0.9rem', fontWeight: 600, margin: '20px 0 8px', color: 'var(--text-secondary)' }}>Custom Voices</h3>
              <div className="voice-grid">
                {voices.map((v) => (
                  <div
                    key={v.voice_id}
                    id={`voice-${v.voice_id}`}
                    className={`voice-card ${voiceId === v.voice_id ? 'voice-selected' : ''}`}
                    onClick={() => setVoiceId(v.voice_id)}
                    style={{ cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setVoiceId(v.voice_id); }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span className="voice-name">{v.name}</span>
                      <button
                        onClick={(e) => handlePlayPreview(v.voice_id, e)}
                        className="preview-play-btn"
                        title="Listen to preview"
                        aria-label={`Listen to preview of ${v.name}`}
                        style={{
                          padding: '4px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: playingId === v.voice_id ? 'var(--gold)' : 'rgba(var(--gold-rgb), 0.08)',
                          color: playingId === v.voice_id ? '#fff' : 'var(--gold)',
                          border: 'none',
                          cursor: 'pointer',
                          width: '24px',
                          height: '24px',
                          flexShrink: 0,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {previewLoadingId === v.voice_id ? (
                          <span className="spinner-small"></span>
                        ) : playingId === v.voice_id ? (
                          <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                            <rect x="6" y="6" width="12" height="12" rx="1" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <span className="voice-meta">{[v.gender, v.accent, v.age].filter(Boolean).join(' · ')}</span>
                  </div>
                ))}
              </div>
            </>
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
