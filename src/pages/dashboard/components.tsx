import type { ReactNode } from 'react'
import type { BadgeTone, ProgressTone } from './statusTones'

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function ProgressBar({
  percent,
  tone = 'accent',
}: {
  percent: number
  tone?: ProgressTone
}) {
  const width = Math.min(100, Math.max(0, percent))

  return (
    <div className="progress-track" role="presentation">
      <div className={`progress-fill progress-${tone}`} style={{ width: `${width}%` }} />
    </div>
  )
}
