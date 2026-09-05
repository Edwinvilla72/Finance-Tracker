import type { projectScenarioImpact } from '../../../calculations/scenarios'
import { currency } from '../../../utils/currency'
import { formatMonthLabel, parseDateKey } from '../../../utils/dates'
import type { ModalView } from '../dashboardTypes'

type ScenarioImpact = ReturnType<typeof projectScenarioImpact>

type MonthlyProjectionPoint = {
  month: string
  balance: number
}

type SpendingTrendPoint = {
  category: string
  amount: number
}

type NetWorthSummary = {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
}

type InsightsPageProps = {
  currentMonth: Date
  fiveYearInvestmentProjection: number
  monthlyProjection: MonthlyProjectionPoint[]
  netWorthSummary: NetWorthSummary
  openModal: (view: Exclude<ModalView, null>) => void
  projectionMonths: number
  scenarioImpact?: ScenarioImpact | null
  spendingTrend: SpendingTrendPoint[]
  totalInvestmentBalance: number
}

export function InsightsPage({
  currentMonth,
  fiveYearInvestmentProjection,
  monthlyProjection,
  netWorthSummary,
  openModal,
  projectionMonths,
  scenarioImpact,
  spendingTrend,
  totalInvestmentBalance,
}: InsightsPageProps) {
  const maxProjectionMagnitude = Math.max(
    1,
    ...monthlyProjection.map((point) => Math.abs(point.balance)),
  )
  const maxSpendingCategory = Math.max(
    1,
    ...spendingTrend.map((item) => item.amount),
  )
  const scenarioBars: Array<[string, number]> = scenarioImpact
    ? [
        ['Paycheck', scenarioImpact.netPaycheck.delta],
        ['Monthly', scenarioImpact.monthlyNet.delta],
        [`${projectionMonths}-month`, scenarioImpact.sixMonthCash.delta],
        ['Net worth', scenarioImpact.netWorth.delta],
      ]
    : []
  const maxScenarioDelta = Math.max(
    1,
    ...scenarioBars.map(([, value]) => Math.abs(value)),
  )

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Insights</p>
            <h1>Trends and overviews</h1>
            <p className="hero-copy">
              The patterns behind your calendar: projected cash, where spending goes, and
              what your wealth looks like.
            </p>
          </div>
        </div>
        <div className="stat-row stat-row-embedded">
          <button type="button" className="stat-card" onClick={() => openModal('netWorth')}>
            <span>Net worth</span>
            <strong>{currency.format(netWorthSummary.netWorth)}</strong>
            <small>
              {currency.format(netWorthSummary.totalAssets)} assets ·{' '}
              {currency.format(netWorthSummary.totalLiabilities)} liabilities
            </small>
          </button>
          <button type="button" className="stat-card" onClick={() => openModal('investments')}>
            <span>Investments</span>
            <strong>{currency.format(totalInvestmentBalance)}</strong>
            <small>
              {currency.format(fiveYearInvestmentProjection)} projected in 5 years
            </small>
          </button>
        </div>
      </section>

      <section className="page-grid-2col">
        <section className="panel chart-panel">
          <div>
            <p className="section-kicker">Cash trend</p>
            <h2>Projected month-end balance</h2>
          </div>
          <div className="bar-chart">
            {monthlyProjection.map((point) => (
              <div className="bar-row" key={point.month}>
                <span>{formatMonthLabel(parseDateKey(point.month)).slice(0, 3)}</span>
                <div className="bar-track">
                  <div
                    className={`bar-fill ${point.balance >= 0 ? 'positive' : 'negative'}`}
                    style={{
                      width: `${Math.max(
                        4,
                        Math.abs(point.balance) / maxProjectionMagnitude * 100,
                      )}%`,
                    }}
                  />
                </div>
                <strong>{currency.format(point.balance)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel chart-panel">
          <div>
            <p className="section-kicker">Spending</p>
            <h2>{formatMonthLabel(currentMonth)} mix</h2>
          </div>
          <div className="bar-chart">
            {spendingTrend.length === 0 ? (
              <p className="empty-copy">No spending categories this month yet.</p>
            ) : (
              spendingTrend.map((item) => (
                <div className="bar-row" key={item.category}>
                  <span>{item.category}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill spending"
                      style={{
                        width: `${Math.max(4, item.amount / maxSpendingCategory * 100)}%`,
                      }}
                    />
                  </div>
                  <strong>{currency.format(item.amount)}</strong>
                </div>
              ))
            )}
          </div>
        </section>
      </section>

      <section className="panel chart-panel">
        <div>
          <p className="section-kicker">Scenario</p>
          <h2>Impact overview</h2>
        </div>
        <div className="bar-chart">
          {scenarioBars.length === 0 ? (
            <p className="empty-copy">Create a scenario to see impact bars.</p>
          ) : (
            scenarioBars.map(([label, value]) => (
              <div className="bar-row" key={label}>
                <span>{label}</span>
                <div className="bar-track">
                  <div
                    className={`bar-fill ${value >= 0 ? 'positive' : 'negative'}`}
                    style={{
                      width: `${Math.max(
                        4,
                        Math.abs(value) / maxScenarioDelta * 100,
                      )}%`,
                    }}
                  />
                </div>
                <strong>{currency.format(value)}</strong>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  )
}
