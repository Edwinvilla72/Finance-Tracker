import { currency } from '../../../utils/currency'
import type { ModalView } from '../dashboardTypes'

type HomePageProps = {
  balanceDisplayValue: number
  balanceHeroPhase: 'approach' | 'impact' | 'resolve' | null
  monthlyIncome: number
  monthlyNet: number
  monthlyOutflow: number
  openModal: (view: Exclude<ModalView, null>) => void
}

export function HomePage({
  balanceDisplayValue,
  balanceHeroPhase,
  monthlyIncome,
  monthlyNet,
  monthlyOutflow,
  openModal,
}: HomePageProps) {
  return (
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
  )
}
