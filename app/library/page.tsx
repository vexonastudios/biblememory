'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLibraryStore } from '@/lib/store/libraryStore';
import {
  isDue, isDueWithin, isMastered, daysUntilReview,
  intervalLabel, sortByUrgency, SRS_INTERVALS, LibraryVerse,
} from '@/lib/srs';

type TabId = 'due' | 'upcoming' | 'all';

const LEVEL_COLORS = [
  '#f87171', // 0 — 1d  (red)
  '#fb923c', // 1 — 3d  (orange)
  '#facc15', // 2 — 7d  (yellow)
  '#4ade80', // 3 — 14d (green)
  '#34d399', // 4 — 30d (teal)
  '#a78bfa', // 5 — 60d (purple — mastered)
];

const LEVEL_LABELS = ['1d', '3d', '7d', '14d', '30d', '★'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function StreakBadge({ count }: { count: number }) {
  if (count < 3) return null;
  return (
    <span className="streak-badge">
      🔥 {count}
    </span>
  );
}

function VerseCard({ verse, onReview, onRemove }: {
  verse: LibraryVerse;
  onReview: (v: LibraryVerse) => void;
  onRemove: (ref: string) => void;
}) {
  const due = isDue(verse);
  const mastered = isMastered(verse);
  const days = daysUntilReview(verse);
  const levelColor = LEVEL_COLORS[verse.repetitionLevel];

  let urgencyClass = 'card-normal';
  if (mastered) urgencyClass = 'card-mastered';
  else if (due) urgencyClass = days < -1 ? 'card-overdue' : 'card-due';
  else if (isDueWithin(verse, 2)) urgencyClass = 'card-soon';

  let dueLabel: string;
  if (mastered) dueLabel = 'Mastered';
  else if (days < 0) dueLabel = `${Math.abs(days)}d overdue`;
  else if (days === 0) dueLabel = 'Due today';
  else if (days === 1) dueLabel = 'Due tomorrow';
  else dueLabel = `In ${days} days`;

  return (
    <div className={`verse-card ${urgencyClass}`}>
      {/* Level indicator bar */}
      <div className="card-level-bar" style={{ background: levelColor }} />

      <div className="card-body">
        <div className="card-top">
          <div className="card-ref-row">
            <span className="card-ref">{verse.reference}</span>
            <span className="card-trans">{verse.translation}</span>
            <StreakBadge count={verse.correctStreak} />
          </div>
          <div className="card-meta-row">
            <span className="card-due-label" style={{ color: due && !mastered ? '#f87171' : 'var(--text-muted)' }}>
              {dueLabel}
            </span>
            <span className="card-interval">{intervalLabel(verse)}</span>
          </div>
        </div>

        <p className="card-text">{verse.text}</p>

        {/* SRS progress dots */}
        <div className="card-srs-track">
          {SRS_INTERVALS.map((_, i) => (
            <div
              key={i}
              className="srs-dot"
              style={{
                background: i <= verse.repetitionLevel ? levelColor : 'rgba(255,255,255,0.08)',
                boxShadow: i === verse.repetitionLevel ? `0 0 6px ${levelColor}` : 'none',
              }}
              title={i === SRS_INTERVALS.length - 1 ? 'Mastered' : `${SRS_INTERVALS[i]}d interval`}
            />
          ))}
          <span className="srs-level-label" style={{ color: levelColor }}>
            {LEVEL_LABELS[verse.repetitionLevel]}
          </span>
        </div>

        <div className="card-footer">
          <span className="card-stats">
            {verse.reviewCount} review{verse.reviewCount !== 1 ? 's' : ''} ·{' '}
            added {formatDate(verse.addedDate)}
          </span>
          <div className="card-actions">
            <button
              className="card-remove-btn"
              onClick={() => onRemove(verse.reference)}
              title="Remove from library"
            >
              ✕
            </button>
            <button
              className={`card-review-btn ${due && !mastered ? 'btn-due' : 'btn-normal'}`}
              onClick={() => onReview(verse)}
            >
              {mastered ? 'Practice' : due ? 'Review Now' : 'Practice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const { verses, removeVerse } = useLibraryStore();
  const [tab, setTab] = useState<TabId>('due');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const dueVerses = sortByUrgency(verses.filter(isDue));
  const upcomingVerses = sortByUrgency(
    verses.filter((v) => !isDue(v) && isDueWithin(v, 7))
  );
  const allVerses = sortByUrgency(verses);

  const masteredCount = verses.filter(isMastered).length;

  const displayed: LibraryVerse[] =
    tab === 'due' ? dueVerses :
    tab === 'upcoming' ? upcomingVerses :
    allVerses;

  const handleReview = (verse: LibraryVerse) => {
    // Navigate to Recite Mode pre-loaded with this verse
    const params = new URLSearchParams({
      ref: verse.reference,
      translation: verse.translation,
    });
    router.push(`/review?${params.toString()}`);
  };

  const handleRemoveConfirm = (ref: string) => {
    setConfirmRemove(ref);
  };

  const handleRemoveExecute = () => {
    if (confirmRemove) {
      removeVerse(confirmRemove);
      setConfirmRemove(null);
    }
  };

  return (
    <div className="library-page">
      {/* Header */}
      <header className="library-header">
        <Link href="/" className="back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Home
        </Link>
        <div className="library-header-center">
          <h1 className="library-title">My Verse Library</h1>
          <p className="library-subtitle">
            {verses.length} verse{verses.length !== 1 ? 's' : ''} ·{' '}
            {masteredCount} mastered
          </p>
        </div>
        <Link href="/settings" className="back-link">Settings</Link>
      </header>

      {/* Summary stats */}
      {verses.length > 0 && (
        <div className="library-stats-bar">
          <div className="lib-stat">
            <span className="lib-stat-num" style={{ color: dueVerses.length > 0 ? '#f87171' : 'var(--accent-green)' }}>
              {dueVerses.length}
            </span>
            <span className="lib-stat-label">Due now</span>
          </div>
          <div className="lib-stat-divider" />
          <div className="lib-stat">
            <span className="lib-stat-num" style={{ color: 'var(--gold)' }}>
              {upcomingVerses.length}
            </span>
            <span className="lib-stat-label">This week</span>
          </div>
          <div className="lib-stat-divider" />
          <div className="lib-stat">
            <span className="lib-stat-num" style={{ color: '#a78bfa' }}>
              {masteredCount}
            </span>
            <span className="lib-stat-label">Mastered</span>
          </div>
          <div className="lib-stat-divider" />
          <div className="lib-stat">
            <span className="lib-stat-num" style={{ color: 'var(--text-secondary)' }}>
              {verses.length}
            </span>
            <span className="lib-stat-label">Total</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      {verses.length > 0 && (
        <div className="lib-tabs">
          {([
            { id: 'due', label: 'Due', count: dueVerses.length },
            { id: 'upcoming', label: 'This Week', count: upcomingVerses.length },
            { id: 'all', label: 'All Verses', count: verses.length },
          ] as { id: TabId; label: string; count: number }[]).map(({ id, label, count }) => (
            <button
              key={id}
              id={`tab-${id}`}
              className={`lib-tab ${tab === id ? 'lib-tab-active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
              {count > 0 && (
                <span className={`tab-badge ${id === 'due' && count > 0 ? 'badge-urgent' : ''}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <main className="library-main">
        {/* Empty state */}
        {verses.length === 0 && (
          <div className="lib-empty">
            <div className="lib-empty-icon">📖</div>
            <h2 className="lib-empty-title">Your library is empty</h2>
            <p className="lib-empty-sub">
              Search for a verse or passage on the home screen and hit{' '}
              <strong>Start Memory Session</strong> — it will be added here
              automatically and scheduled for spaced repetition review.
            </p>
            <Link href="/" className="lib-empty-btn">
              Memorize a Passage
            </Link>
          </div>
        )}

        {/* Due tab — empty */}
        {verses.length > 0 && tab === 'due' && dueVerses.length === 0 && (
          <div className="lib-empty">
            <div className="lib-empty-icon">✅</div>
            <h2 className="lib-empty-title">All caught up!</h2>
            <p className="lib-empty-sub">No verses due for review right now. Keep it up!</p>
            <button className="lib-empty-btn" onClick={() => setTab('upcoming')}>
              See What&apos;s Coming
            </button>
          </div>
        )}

        {/* Verse cards */}
        {displayed.length > 0 && (
          <div className="verse-card-grid">
            {displayed.map((verse) => (
              <VerseCard
                key={verse.reference}
                verse={verse}
                onReview={handleReview}
                onRemove={handleRemoveConfirm}
              />
            ))}
          </div>
        )}

        {/* How SRS works */}
        {verses.length > 0 && (
          <div className="srs-explainer">
            <h3 className="explainer-title">How Review Scheduling Works</h3>
            <div className="srs-levels">
              {SRS_INTERVALS.map((days, i) => (
                <div key={i} className="srs-level-item">
                  <div className="srs-level-dot" style={{ background: LEVEL_COLORS[i] }} />
                  <span className="srs-level-name">{LEVEL_LABELS[i]}</span>
                  <span className="srs-level-desc">
                    {i === 0 ? 'New — review tomorrow'
                      : i === SRS_INTERVALS.length - 1 ? 'Mastered!'
                      : `Every ${days} days`}
                  </span>
                </div>
              ))}
            </div>
            <p className="srs-note">
              Each successful Recite session advances your interval. Miss 75% accuracy and it resets to daily review.
            </p>
          </div>
        )}
      </main>

      {/* Remove confirmation modal */}
      {confirmRemove && (
        <div className="modal-backdrop" onClick={() => setConfirmRemove(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Remove verse?</h3>
            <p className="modal-desc">
              <strong>{confirmRemove}</strong> will be removed from your library and all review progress lost.
            </p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setConfirmRemove(null)}>Cancel</button>
              <button className="modal-confirm" onClick={handleRemoveExecute}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
