import {
  goalStatusLabels,
  portfolioStatusLabels,
  type GoalPortfolioSummary,
} from '../../../calculations/goals'
import type { DebtPlan } from '../../../types/finance'
import { currency } from '../../../utils/currency'
import { formatShortDate } from '../../../utils/dates'
import { Badge, ProgressBar } from '../components'
import {
  goalStatusTones,
  portfolioStatusTones,
  progressToneForStatus,
} from '../statusTones'
import type { GoalItem, GoalItemKind } from '../goalItems'
import type { ModalView } from '../dashboardTypes'

type GoalsPageProps = {
  debtPlans: DebtPlan[]
  goalItems: GoalItem[]
  goalPortfolio: GoalPortfolioSummary
  monthlyNet: number
  openModal: (view: Exclude<ModalView, null>) => void
  removeGoal: (kind: GoalItemKind, originId: number) => void
}

const editModalForKind: Record<GoalItemKind, Exclude<ModalView, null>> = {
  purchase: 'purchaseGoals',
  target: 'plan',
  debt: 'debt',
  emergency: 'emergencyFund',
}

function describePortfolio(portfolio: GoalPortfolioSummary) {
  if (portfolio.status === 'no_goals') {
    return 'Add a goal and the planner will judge it against your monthly surplus.'
  }

  if (portfolio.monthlySurplus <= 0) {
    return 'Your schedule leaves no monthly surplus, so goals have nothing to draw from. Add income or trim spending first.'
  }

  const committed = currency.format(Math.ceil(portfolio.requiredMonthlyTotal))
  const surplus = currency.format(Math.floor(portfolio.monthlySurplus))

  if (portfolio.status === 'comfortable') {
    return `Your goals need about ${committed}/mo and your surplus is ${surplus}/mo, so the plan fits with room to spare.`
  }

  if (portfolio.status === 'tight') {
    return `Your goals need about ${committed}/mo out of a ${surplus}/mo surplus. The plan works, but one surprise could break it.`
  }

  return `Your goals need about ${committed}/mo but your surplus is only ${surplus}/mo. Move a date, trim a goal, or free up cash.`
}

function describeGoal(goal: GoalItem) {
  const { feasibility } = goal
  const required = currency.format(Math.ceil(feasibility.requiredMonthlySaving))
  const shortfall = currency.format(Math.ceil(feasibility.monthlyShortfall))
  const isDebt = goal.kind === 'debt'

  if (feasibility.status === 'funded') {
    return goal.kind === 'emergency'
      ? 'Fully funded. Nice safety net.'
      : 'Your current schedule already covers this by the target date.'
  }

  if (feasibility.status === 'on_track') {
    return `${isDebt ? 'Paying' : 'Saving'} ${required}/mo ${goal.targetLabel} fits inside your monthly surplus.`
  }

  const earliest = feasibility.earliestFeasibleDate
    ? ` At your current surplus, a realistic date is around ${formatShortDate(
        feasibility.earliestFeasibleDate,
      )}.`
    : ' Right now there is no monthly surplus to draw from.'

  if (feasibility.status === 'stretch') {
    return `You are about ${shortfall}/mo short of the ${required}/mo this needs.${earliest}`
  }

  return `This needs ${required}/mo, well beyond your current surplus.${earliest}`
}

export function GoalsPage({
  debtPlans,
  goalItems,
  goalPortfolio,
  monthlyNet,
  openModal,
  removeGoal,
}: GoalsPageProps) {
  const untargetedDebts = debtPlans.filter((debt) => !debt.payoffDate)

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Goals</p>
            <h1>How feasible is your plan?</h1>
            <p className="hero-copy">{describePortfolio(goalPortfolio)}</p>
          </div>
          {goalItems.length > 0 ? (
            <Badge tone={portfolioStatusTones[goalPortfolio.status]}>
              {portfolioStatusLabels[goalPortfolio.status]}
            </Badge>
          ) : null}
        </div>

        <div className="stat-row stat-row-embedded">
          <div className="stat-card">
            <span>Monthly surplus</span>
            <strong className={monthlyNet >= 0 ? 'positive-text' : 'negative-text'}>
              {monthlyNet >= 0 ? '+' : '-'}
              {currency.format(Math.abs(monthlyNet))}
            </strong>
            <small>Projected income minus outflow this month</small>
          </div>
          <div className="stat-card">
            <span>Committed to goals</span>
            <strong>{currency.format(Math.ceil(goalPortfolio.requiredMonthlyTotal))}</strong>
            <small>Required saving across every goal</small>
          </div>
          <div className="stat-card">
            <span>Free after goals</span>
            <strong
              className={goalPortfolio.freeAfterGoals >= 0 ? 'positive-text' : 'negative-text'}
            >
              {goalPortfolio.freeAfterGoals >= 0 ? '+' : '-'}
              {currency.format(Math.abs(Math.round(goalPortfolio.freeAfterGoals)))}
            </strong>
            <small>
              {goalPortfolio.commitmentPercent !== null
                ? `Goals use ${Math.round(goalPortfolio.commitmentPercent)}% of your surplus`
                : 'No surplus available yet'}
            </small>
          </div>
        </div>

        <div className="toolbar-buttons">
          <button type="button" className="primary-action" onClick={() => openModal('purchaseGoals')}>
            Add purchase goal
          </button>
          <button type="button" className="ghost-button" onClick={() => openModal('emergencyFund')}>
            Emergency fund
          </button>
          <button type="button" className="ghost-button" onClick={() => openModal('plan')}>
            Balance target
          </button>
          <button type="button" className="ghost-button" onClick={() => openModal('debt')}>
            Debt payoff
          </button>
        </div>
      </section>

      {goalItems.length === 0 ? (
        <section className="panel">
          <div className="empty-state">
            <p className="empty-copy">
              Nothing here yet. Goals can be a purchase you are saving for, an emergency
              fund, a balance target, or a debt you want gone by a date. Each one gets a
              feasibility check against your real cash flow.
            </p>
          </div>
        </section>
      ) : (
        <section className="goal-grid">
          {goalItems.map((goal) => (
            <article className="panel goal-card" key={goal.key}>
              <div className="goal-card-header">
                <div>
                  <strong>{goal.title}</strong>
                  <p className="goal-meta">
                    {currency.format(goal.amount)} {goal.targetLabel}
                  </p>
                </div>
                <Badge tone={goalStatusTones[goal.feasibility.status]}>
                  {goalStatusLabels[goal.feasibility.status]}
                </Badge>
              </div>

              {goal.progressPercent !== null ? (
                <div className="goal-progress">
                  <ProgressBar
                    percent={goal.progressPercent}
                    tone={progressToneForStatus(goal.feasibility.status)}
                  />
                  <span className="goal-progress-label">
                    {Math.round(goal.progressPercent)}% covered
                  </span>
                </div>
              ) : null}

              <div className="goal-facts">
                <div>
                  <span>{goal.kind === 'debt' ? 'Payment needed' : 'Saving needed'}</span>
                  <strong>
                    {goal.feasibility.requiredMonthlySaving > 0
                      ? `${currency.format(Math.ceil(goal.feasibility.requiredMonthlySaving))}/mo`
                      : 'None'}
                  </strong>
                </div>
                <div>
                  <span>Months left</span>
                  <strong>{goal.feasibility.monthsUntilTarget}</strong>
                </div>
                {goal.feasibility.monthlyShortfall > 0 ? (
                  <div>
                    <span>Monthly shortfall</span>
                    <strong className="negative-text">
                      {currency.format(Math.ceil(goal.feasibility.monthlyShortfall))}
                    </strong>
                  </div>
                ) : null}
              </div>

              <p className="goal-guidance">{describeGoal(goal)}</p>

              <div className="row-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => openModal(editModalForKind[goal.kind])}
                >
                  Edit
                </button>
                {(goal.kind === 'purchase' || goal.kind === 'debt') &&
                goal.originId !== null ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => removeGoal(goal.kind, goal.originId as number)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}

      {untargetedDebts.length > 0 ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Heads up</p>
              <h2>Debts without a payoff target</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => openModal('debt')}>
              Set targets
            </button>
          </div>
          <p className="empty-copy">
            {untargetedDebts.map((debt) => debt.title).join(', ')}{' '}
            {untargetedDebts.length === 1 ? 'has' : 'have'} no payoff date, so the planner
            cannot judge feasibility for {untargetedDebts.length === 1 ? 'it' : 'them'}.
          </p>
        </section>
      ) : null}
    </>
  )
}
