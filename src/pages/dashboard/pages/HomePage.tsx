import { currency } from '../../../utils/currency'
import type { ModalView } from '../dashboardTypes'

export type SetupStep = {
  key: string
  title: string
  detail: string
  done: boolean
  modal: Exclude<ModalView, null>
}

type HomePageProps = {
  balanceDisplayValue: number
  balanceHeroPhase: 'approach' | 'impact' | 'resolve' | null
  monthlyIncome: number
  monthlyNet: number
  monthlyOutflow: number
  onDismissSetupGuide: () => void
  openModal: (view: Exclude<ModalView, null>) => void
  setupSteps: SetupStep[]
  showSetupGuide: boolean
}

export function HomePage({
  balanceDisplayValue,
  balanceHeroPhase,
  monthlyIncome,
  monthlyNet,
  monthlyOutflow,
  onDismissSetupGuide,
  openModal,
  setupSteps,
  showSetupGuide,
}: HomePageProps) {
  return (
    <>
      {showSetupGuide ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Set up your planner</h2>
            <button type="button" className="nav-quiet" onClick={onDismissSetupGuide}>
              Hide
            </button>
          </div>
          <div className="setup-steps">
            {setupSteps.map((step, index) => (
              <button
                type="button"
                key={step.key}
                className={`setup-step ${step.done ? 'setup-step-done' : ''}`}
                onClick={() => openModal(step.modal)}
              >
                <span className="setup-step-mark" aria-hidden="true">
                  {step.done ? '✓' : index + 1}
                </span>
                <span className="setup-step-body">
                  <strong>{step.title}</strong>
                  <span>{step.detail}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel stat-band">
        <button
          type="button"
          className={`stat-block stat-block-action ${
            balanceHeroPhase ? `balance-hero-${balanceHeroPhase}` : ''
          }`}
          onClick={() => openModal('balanceEdit')}
        >
          <span>Balance</span>
          <strong>{currency.format(balanceDisplayValue)}</strong>
        </button>
        <div className="stat-block">
          <span>Income</span>
          <strong className="positive-text">+{currency.format(monthlyIncome)}</strong>
        </div>
        <div className="stat-block">
          <span>Expenses</span>
          <strong className="negative-text">-{currency.format(monthlyOutflow)}</strong>
        </div>
        <div className="stat-block">
          <span>Net</span>
          <strong className={monthlyNet >= 0 ? 'positive-text' : 'negative-text'}>
            {monthlyNet >= 0 ? '+' : '-'}
            {currency.format(Math.abs(monthlyNet))}
          </strong>
        </div>
      </section>
    </>
  )
}
