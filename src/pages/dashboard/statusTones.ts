import type {
  GoalFeasibilityStatus,
  GoalPortfolioStatus,
} from '../../calculations/goals'

export type BadgeTone = 'positive' | 'warning' | 'negative' | 'neutral' | 'accent'

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
