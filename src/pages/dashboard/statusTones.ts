import type {
  GoalFeasibilityStatus,
  GoalPortfolioStatus,
} from '../../calculations/goals'
import type { FeedbackStatus, FeedbackType } from '../../types/feedback'

export type BadgeTone = 'positive' | 'warning' | 'negative' | 'neutral' | 'accent'

export const feedbackStatusTones: Record<FeedbackStatus, BadgeTone> = {
  open: 'accent',
  in_progress: 'warning',
  resolved: 'positive',
  wont_fix: 'neutral',
}

export const feedbackTypeTones: Record<FeedbackType, BadgeTone> = {
  feature: 'accent',
  bug: 'negative',
  other: 'neutral',
}

export type ProgressTone = 'accent' | 'positive' | 'warning' | 'negative'

export const goalStatusTones: Record<GoalFeasibilityStatus, BadgeTone> = {
  funded: 'positive',
  on_track: 'positive',
  stretch: 'warning',
  at_risk: 'negative',
}

export const portfolioStatusTones: Record<GoalPortfolioStatus, BadgeTone> = {
  comfortable: 'positive',
  tight: 'warning',
  overcommitted: 'negative',
  no_goals: 'neutral',
}

export function progressToneForStatus(status: GoalFeasibilityStatus): ProgressTone {
  if (status === 'funded' || status === 'on_track') {
    return 'positive'
  }

  if (status === 'stretch') {
    return 'warning'
  }

  return 'negative'
}
