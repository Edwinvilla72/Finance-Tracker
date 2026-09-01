import type { Dispatch, SetStateAction } from 'react'

import { getSignedAmount } from '../../calculations/cashFlow'
import type { CalendarOccurrence, TransactionType } from '../../types/finance'
import { currency } from '../../utils/currency'
import {
  formatDateKey,
  formatMonthLabel,
  formatShortDate,
  weekdayLabels,
} from '../../utils/dates'

type CalendarPanelProps = {
  allOccurrences: CalendarOccurrence[]
  calendarDays: Array<Date | null>
  currentMonth: Date
  openDay: (dateKey: string) => void
  projectedBalance: (targetDateKey: string) => number
  selectedDateKey: string
  setCurrentMonth: Dispatch<SetStateAction<Date>>
  todayKey: string
  upcomingTransactions: CalendarOccurrence[]
}

export function CalendarPanel({
  allOccurrences,
  calendarDays,
  currentMonth,
  openDay,
  projectedBalance,
  selectedDateKey,
  setCurrentMonth,
  todayKey,
  upcomingTransactions,
}: CalendarPanelProps) {
  return (
    <section className="workspace-grid">
      <section className="panel calendar-card">
        <div className="calendar-header">
          <h2>{formatMonthLabel(currentMonth)}</h2>
          <div className="month-controls">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                setCurrentMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() =>
                setCurrentMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
            >
              ›
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
                  {dayItems.length > 0 && dateKey >= todayKey
                    ? `End day: ${currency.format(dayEndBalance)}`
                    : ''}
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
        <div className="calendar-header">
          <h2>Upcoming</h2>
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
                  <p>{formatShortDate(transaction.date)}</p>
                </div>
                <span
                  className={`day-net ${
                    getSignedAmount(transaction.amount, transaction.type) >= 0
                      ? 'positive'
                      : 'negative'
                  }`}
                >
                  {getSignedAmount(transaction.amount, transaction.type) >= 0 ? '+' : '-'}
                  {currency.format(transaction.amount)}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>
    </section>
  )
}
