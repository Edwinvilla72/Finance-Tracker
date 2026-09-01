const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const withCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Shows cents only when an amount actually has them, so whole-dollar figures
// stay compact.
export const currency = {
  format(value: number) {
    const cents = Math.round(value * 100) / 100

    return Number.isInteger(cents) ? wholeDollars.format(cents) : withCents.format(cents)
  },
}
