import type { projectScenarioImpact } from '../../../calculations/scenarios'
import type { ScenarioPlan } from '../../../types/finance'
import { currency } from '../../../utils/currency'
import { Badge } from '../components'
import type { ModalView } from '../dashboardTypes'

type ScenarioImpact = ReturnType<typeof projectScenarioImpact>

type ScenariosPageProps = {
  activateScenario: (id: number) => void
  activeScenario?: ScenarioPlan | null
  openModal: (view: Exclude<ModalView, null>) => void
  projectionMonths: number
  removeScenario: (id: number) => void
  scenarioImpact?: ScenarioImpact | null
  scenarioPlans: ScenarioPlan[]
}

export function ScenariosPage({
  activateScenario,
  activeScenario,
  openModal,
  projectionMonths,
  removeScenario,
  scenarioImpact,
  scenarioPlans,
}: ScenariosPageProps) {
  const comparisonLabels: Array<[keyof ScenarioImpact, string]> = [
    ['netPaycheck', 'Net paycheck'],
    ['monthlyNet', 'Monthly cash flow'],
    ['sixMonthCash', `${projectionMonths}-month cash`],
    ['totalDebt', `Debt after ${projectionMonths} months`],
    ['netWorth', 'Net worth'],
    ['investmentFiveYearValue', '5-year investments'],
  ]

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Scenarios</p>
            <h1>What-if planning</h1>
            <p className="hero-copy">
              Compare your baseline against a possible change before you commit to it.
            </p>
          </div>
          <button type="button" className="primary-action" onClick={() => openModal('scenarios')}>
            Build scenario
          </button>
        </div>
      </section>

      {activeScenario && scenarioImpact ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Active scenario</p>
              <h2>{activeScenario.title}</h2>
            </div>
            <Badge
              tone={scenarioImpact.sixMonthCash.delta >= 0 ? 'positive' : 'negative'}
            >
              {scenarioImpact.sixMonthCash.delta >= 0 ? '+' : '-'}
              {currency.format(Math.abs(scenarioImpact.sixMonthCash.delta))} over{' '}
              {projectionMonths} months
            </Badge>
          </div>

          <div className="comparison-table">
            <div className="comparison-row comparison-head">
              <span>Measure</span>
              <span>Baseline</span>
              <span>Scenario</span>
              <span>Change</span>
            </div>
            {comparisonLabels.map(([key, label]) => {
              const comparison = scenarioImpact[key]

              return (
                <div className="comparison-row" key={key}>
                  <span>{label}</span>
                  <strong>{currency.format(comparison.baseline)}</strong>
                  <strong>{currency.format(comparison.scenario)}</strong>
                  <strong
                    className={comparison.delta >= 0 ? 'positive-text' : 'negative-text'}
                  >
                    {comparison.delta >= 0 ? '+' : '-'}
                    {currency.format(Math.abs(comparison.delta))}
                  </strong>
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <section className="panel">
          <div className="empty-state">
            <p className="empty-copy">
              No scenario yet. Model an income change, a rent increase, an extra debt
              payment, or a one-time purchase and see how it moves your paycheck, cash
              flow, and net worth.
            </p>
          </div>
        </section>
      )}

      {scenarioPlans.length > 0 ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Saved</p>
              <h2>Your scenarios</h2>
            </div>
          </div>
          <div className="line-list">
            {scenarioPlans.map((scenario, index) => (
              <div className="line-item" key={scenario.id}>
                <div>
                  <strong>{scenario.title}</strong>
                  <p>
                    Income {scenario.incomeChangePercent}% · Rent{' '}
                    {currency.format(scenario.rentChange)} · Extra debt{' '}
                    {currency.format(scenario.extraDebtPayment)}
                  </p>
                </div>
                <div className="line-item-side">
                  {index === 0 ? (
                    <Badge tone="accent">Active</Badge>
                  ) : (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => activateScenario(scenario.id)}
                    >
                      Make active
                    </button>
                  )}
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => removeScenario(scenario.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}
