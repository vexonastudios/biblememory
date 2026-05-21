'use client';

interface Props {
  current: number;   // 1-indexed loop (e.g. 2)
  total: number;     // total loops (e.g. 3)
}

export default function ProgressRing({ current, total }: Props) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? current / total : 0;
  const offset = circumference - progress * circumference;

  return (
    <div className="progress-ring-wrap" title={`Loop ${current} of ${total}`}>
      <svg width="72" height="72" viewBox="0 0 72 72">
        {/* Track */}
        <circle
          cx="36" cy="36" r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="5"
        />
        {/* Progress */}
        <circle
          cx="36" cy="36" r={radius}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="progress-ring-label">
        <span className="ring-current">{current}</span>
        <span className="ring-sep">/</span>
        <span className="ring-total">{total}</span>
      </div>
    </div>
  );
}
