import type { ReactNode } from 'react'

import { feedbackStatusLabel, feedbackTypeLabel } from '../../services/feedbackService'
import type { FeedbackItem } from '../../types/feedback'
import { Badge } from './components'
import { feedbackStatusTones, feedbackTypeTones } from './statusTones'

type FeedbackCardProps = {
  item: FeedbackItem
  showSubmitter?: boolean
  showAdminNotes?: boolean
  children?: ReactNode
}

function formatFeedbackDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function FeedbackCard({
  item,
  showSubmitter = false,
  showAdminNotes = true,
  children,
}: FeedbackCardProps) {
  const tone = feedbackStatusTones[item.status]

  return (
    <article className={`feedback-card tone-${tone}`}>
      <div className="feedback-card-head">
        <div className="feedback-badges">
          <Badge tone={tone}>{feedbackStatusLabel(item.status)}</Badge>
          <Badge tone={feedbackTypeTones[item.type]}>{feedbackTypeLabel(item.type)}</Badge>
        </div>
        <span className="feedback-meta">
          {showSubmitter && item.userEmail ? `${item.userEmail} · ` : ''}
          {formatFeedbackDate(item.createdAt)}
        </span>
      </div>

      <strong className="feedback-title">{item.title}</strong>
      <p className="feedback-body">{item.description}</p>

      {item.additionalDetails ? (
        <div className="feedback-detail">
          <span className="feedback-label">Additional details</span>
          <p className="feedback-body">{item.additionalDetails}</p>
        </div>
      ) : null}

      {showAdminNotes && item.adminNotes ? (
        <div className="feedback-detail feedback-note">
          <span className="feedback-label">Note from the admin</span>
          <p className="feedback-body">{item.adminNotes}</p>
        </div>
      ) : null}

      {item.resolvedAt ? (
        <span className="feedback-meta">Closed {formatFeedbackDate(item.resolvedAt)}</span>
      ) : null}

      {children}
    </article>
  )
}
