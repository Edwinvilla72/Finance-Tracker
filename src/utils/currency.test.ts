import { describe, expect, it } from 'vitest'
import { currency } from './currency'

describe('currency.format', () => {
  it('keeps whole-dollar amounts compact', () => {
    expect(currency.format(2455)).toBe('$2,455')
    expect(currency.format(0)).toBe('$0')
  })

  it('shows cents when an amount has them', () => {
    expect(currency.format(12.5)).toBe('$12.50')
    expect(currency.format(1234.99)).toBe('$1,234.99')
  })

  it('rounds floating point noise away', () => {
    expect(currency.format(1670.0000000001)).toBe('$1,670')
    expect(currency.format(0.1 + 0.2)).toBe('$0.30')
  })
})
