import type { Dispatch, SetStateAction } from 'react'

import { getSignedAmount } from '../../calculations/cashFlow'
import { getCadenceLabel, getRecommendedPayment } from '../../calculations/debtPayoff'
import type { CalendarOccurrence, DebtPlan, TransactionType } from '../../types/finance'
import { currency } from '../../utils/currency'
import {
  formatDateKey,
  formatLongDate,
  formatMonthLabel,
  weekdayLabels,
} from '../../utils/dates'

type CalendarPanelProps = {
  allOccurrences: CalendarOccurrence[]
  calendarDays: Array<Date | null>
  currentMonth: Date
  debtPlans: DebtPlan[]
  openDay: (dateKey: string) => void
  projectedBalance: (targetDateKey: string) => number
  selectedDateKey: string
  setCurrentMonth: Dispatch<SetStateAction<Date>>
  today: Date
  todayKey: string
  upcomingTransactions: CalendarOccurrence[]
}

export function CalendarPanel({
  allOccurrences,
  calendarDays,
  currentMonth,
  debtPlans,
  openDay,
  projectedBalance,
  selectedDateKey,
  setCurrentMonth,
  today,
  todayKey,
  upcomingTransactions,
}: CalendarPanelProps) {
  return (
    <section className="workspace-grid">
      <section className="panel calendar-card">
        <div className="calendar-header">
          <div>
            <p className="section-kicker">Calendar</p>
            <h2>Scheduled transactions and payments</h2>
          </div>
          <div className="month-controls">
            <button
              type="button"
              onClick={() =>
                setCurrentMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
            >
              Prev
            </button>
            <strong>{formatMonthLabel(currentMonth)}</strong>
            <button
              type="button"
              onClick={() =>
                setCurrentMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
            >
              Next
            </button>
          </div>
        </div>

        <div className="weekday-row">
          {weekdayLabels.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="day-cell empty-day" />
            }

            const dateKey = formatDateKey(date)
            const dayItems = allOccurrences.filter(
              (transaction) => transaction.date === dateKey,
            )
            const dayNet = dayItems.reduce(
              (sum, transaction) =>
                sum + getSignedAmount(transaction.amount, transaction.type),
              0,
            )
            const dayEndBalance = projectedBalance(dateKey)
            const previewTitles = dayItems
              .slice(0, 2)
              .map((item) => item.title)
              .join(' • ')
            const isSelected = dateKey === selectedDateKey
            const isToday = dateKey === todayKey

            return (
              <button
                type="button"
                key={dateKey}
                className={`day-cell ${isSelected ? 'selected-day' : ''} ${isToday ? 'today-cell' : ''}`}
                onClick={() => openDay(dateKey)}
              >
                <span className="day-number">{date.getDate()}</span>
                <div className="indicator-row">
                  {dayItems.slice(0, 4).map((item) => (
                    <span
                      key={item.id}
                      className={`indicator-dot ${item.type as TransactionType}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <span className={`day-net ${dayNet >= 0 ? 'positive' : 'negative'}`}>
                  {dayItems.length > 0
                    ? `${dayNet >= 0 ? '+' : '-'}${currency.format(Math.abs(dayNet))}`
                    : ''}
                </span>
                <span className="day-balance">
                  {dayItems.length > 0 ? `End day: ${currency.format(dayEndBalance)}` : ''}
                </span>
                <span className="day-preview">
                  {dayItems.length > 0
                    ? dayItems.length > 2
                      ? `${previewTitles} +${dayItems.length - 2} more`
                      : previewTitles
                    : ''}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <aside className="panel upcoming-card">
        <div className="sidebar-section">
          <div className="sidebar-header">
            <div>
              <p className="section-kicker">Upcoming</p>
              <h2>Next scheduled transactions</h2>
            </div>
          </div>

          <div className="upcoming-list">
            {upcomingTransactions.length === 0 ? (
              <p className="empty-copy">No scheduled transactions yet.</p>
            ) : (
              upcomingTransactions.map((transaction) => (
                <button
                  type="button"
                  key={transaction.id}
                  className="upcoming-row"
                  onClick={() => openDay(transaction.date)}
                >
                  <div>
                    <strong>{transaction.title}</strong>
                    <p>{formatLongDate(transaction.date)}</p>
                  </div>
                  <div className="upcoming-amount">
                    <span
                      className={`day-net ${
                        getSignedAmount(transaction.amount, transaction.type) >= 0
                          ? 'positive'
                          : 'negative'
                      }`}
                    >
                      {getSignedAmount(transaction.amount, transaction.type) >= 0
                        ? '+'
                        : '-'}
                      {currency.format(transaction.amount)}
                    </span>
                    <p>{transaction.type}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-header">
            <div>
              <p className="section-kicker">Debt</p>
              <h2>What you owe</h2>
            </div>
          </div>

          <div className="debt-summary-list">
            {debtPlans.length === 0 ? (
              <p className="empty-copy">No debts tracked yet.</p>
            ) : (
              debtPlans.map((debt) => (
                <div className="debt-summary-row" key={debt.id}>
                  <div>
                    <strong>{debt.title}</strong>
                    <p>Due {formatLongDate(debt.dueDate)}</p>
                  </div>
                  <div className="upcoming-amount">
                    <span className="day-net negative">
                      -{currency.format(debt.balance)}
                    </span>
                    <p>
                      {debt.payoffDate
                        ? `Target ${formatLongDate(debt.payoffDate)}`
                        : 'No payoff target'}
                    </p>
                    {debt.payoffDate && debt.payoffCadence ? (
                      <p>
                        {currency.format(
                          Math.ceil(
                            getRecommendedPayment(
                              debt.balance,
                              debt.payoffDate,
                              debt.payoffCadence,
                              today,
                            ),
                          ),
                        )}{' '}
                        {getCadenceLabel(debt.payoffCadence)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </section>
  )
}
