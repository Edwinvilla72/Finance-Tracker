import { portfolioStatusLabels } from '../../../calculations/goals'
import type { CalendarOccurrence } from '../../../types/finance'
import { currency } from '../../../utils/currency'
import { formatMonthLabel, formatShortDate } from '../../../utils/dates'
import { Badge, ProgressBar } from '../components'
import {
  goalStatusTones,
  portfolioStatusTones,
  progressToneForStatus,
  type BadgeTone,
} from '../statusTones'
import type { GoalItem } from '../goalItems'
import type { GoalPortfolioSummary } from '../../../calculations/goals'
import { goalStatusLabels } from '../../../calculations/goals'
import type { ModalView, PageView } from '../dashboardTypes'

type PaycheckEstimateSummary = {
  estimatedNetPaycheck: number
  grossPerPaycheck: number
}

type HomePageProps = {
  balanceDisplayValue: number
  balanceHeroPhase: 'approach' | 'impact' | 'resolve' | null
  currentCashSourceLabel: string
  currentMonth: Date
  goalItems: GoalItem[]
  goalPortfolio: GoalPortfolioSummary
  healthLabel: string
  monthlyIncome: number
  monthlyNet: number
  monthlyOutflow: number
  nextPaycheck?: CalendarOccurrence | null
  onNavigate: (page: PageView) => void
  openModal: (view: Exclude<ModalView, null>) => void
  paycheckEstimate?: PaycheckEstimateSummary | null
  primaryRecommendation: string
  sixMonthProjection: number
}

const healthTones: Record<string, BadgeTone> = {
  Stable: 'positive',
  Tight: 'warning',
  'Needs attention': 'negative',
}

export function HomePage({
  balanceDisplayValue,
  balanceHeroPhase,
  currentCashSourceLabel,
  currentMonth,
  goalItems,
  goalPortfolio,
  healthLabel,
  monthlyIncome,
  monthlyNet,
  monthlyOutflow,
  nextPaycheck,
  onNavigate,
  openModal,
  paycheckEstimate,
  primaryRecommendation,
  sixMonthProjection,
}: HomePageProps) {
  const monthLabel = formatMonthLabel(currentMonth)
  const featuredGoals = goalItems.slice(0, 3)

  return (
    <>
      <section className="panel hero-panel">
        <div className="hero-main">
          <p className="eyebrow">Overview</p>
          <div className="hero-status-row">
            <h1>{healthLabel}</h1>
            <Badge tone={healthTones[healthLabel] ?? 'neutral'}>{monthLabel}</Badge>
          </div>
          <p className="hero-copy">{primaryRecommendation}</p>
          <div className="toolbar-buttons">
            <button type="button" className="primary-action" onClick={() => openModal('incomeModel')}>
              Model paycheck
            </button>
            <button type="button" className="ghost-button" onClick={() => openModal('essentials')}>
              Add rent & bills
            </button>
            <button type="button" className="ghost-button" onClick={() => openModal('oneTime')}>
              Schedule transaction
            </button>
            <button type="button" className="ghost-button" onClick={() => openModal('bankSync')}>
              Link bank
            </button>
          </div>
        </div>
        <button
          type="button"
          className={`balance-hero ${balanceHeroPhase ? `balance-hero-${balanceHeroPhase}` : ''}`}
          onClick={() => openModal('balanceEdit')}
        >
          <span>Current cash</span>
          <strong>{currency.format(balanceDisplayValue)}</strong>
          <small>{currentCashSourceLabel}</small>
        </button>
      </section>

      <section className="stat-row">
        <div className="stat-card">
          <span>Income · {monthLabel}</span>
          <strong className="positive-text">{currency.format(monthlyIncome)}</strong>
        </div>
        <div className="stat-card">
          <span>Spending · {monthLabel}</span>
          <strong className="negative-text">{currency.format(monthlyOutflow)}</strong>
        </div>
        <div className="stat-card">
          <span>Monthly surplus</span>
          <strong className={monthlyNet >= 0 ? 'positive-text' : 'negative-text'}>
            {monthlyNet >= 0 ? '+' : '-'}
            {currency.format(Math.abs(monthlyNet))}
          </strong>
        </div>
        <button type="button" className="stat-card" onClick={() => openModal('paycheck')}>
          <span>Next paycheck</span>
          <strong>
            {nextPaycheck ? currency.format(nextPaycheck.amount) : 'Not scheduled'}
          </strong>
          <small>
            {nextPaycheck ? formatShortDate(nextPaycheck.date) : 'Add income timing'}
          </small>
        </button>
        <button type="button" className="stat-card" onClick={() => openModal('incomeModel')}>
          <span>Estimated take-home</span>
          <strong>
            {paycheckEstimate
              ? currency.format(paycheckEstimate.estimatedNetPaycheck)
              : 'Not modeled'}
          </strong>
          <small>
            {paycheckEstimate
              ? `${currency.format(paycheckEstimate.grossPerPaycheck)} gross`
              : 'Add salary and filing status'}
          </small>
        </button>
        <div className="stat-card">
          <span>6-month outlook</span>
          <strong className={sixMonthProjection >= 0 ? 'positive-text' : 'negative-text'}>
            {currency.format(sixMonthProjection)}
          </strong>
          <small>Projected cash from your schedule</small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="section-kicker">Goals</p>
            <h2>Are your goals on track?</h2>
          </div>
          <div className="panel-header-side">
            {goalItems.length > 0 ? (
              <Badge tone={portfolioStatusTones[goalPortfolio.status]}>
                {portfolioStatusLabels[goalPortfolio.status]}
              </Badge>
            ) : null}
            <button type="button" className="ghost-button" onClick={() => onNavigate('goals')}>
              View all goals
            </button>
          </div>
        </div>

        {featuredGoals.length === 0 ? (
          <div className="empty-state">
            <p className="empty-copy">
              No goals yet. Add one and the planner will tell you whether it fits your
              cash flow.
            </p>
            <div className="toolbar-buttons">
              <button type="button" className="ghost-button" onClick={() => openModal('purchaseGoals')}>
                Add purchase goal
              </button>
              <button type="button" className="ghost-button" onClick={() => openModal('emergencyFund')}>
                Plan emergency fund
              </button>
              <button type="button" className="ghost-button" onClick={() => openModal('plan')}>
                Set balance target
              </button>
            </div>
          </div>
        ) : (
          <div className="goal-strip">
            {featuredGoals.map((goal) => (
              <button
                type="button"
                className="goal-card goal-card-compact"
                key={goal.key}
                onClick={() => onNavigate('goals')}
              >
                <div className="goal-card-header">
                  <strong>{goal.title}</strong>
                  <Badge tone={goalStatusTones[goal.feasibility.status]}>
                    {goalStatusLabels[goal.feasibility.status]}
                  </Badge>
                </div>
                <p className="goal-meta">
                  {currency.format(goal.amount)} {goal.targetLabel}
                </p>
                {goal.progressPercent !== null ? (
                  <ProgressBar
                    percent={goal.progressPercent}
                    tone={progressToneForStatus(goal.feasibility.status)}
                  />
                ) : null}
                <p className="goal-meta">
                  {goal.feasibility.requiredMonthlySaving > 0
                    ? `Needs ${currency.format(
                        Math.ceil(goal.feasibility.requiredMonthlySaving),
                      )}/mo`
                    : 'Covered by your current schedule'}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
