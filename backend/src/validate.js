import { AppError } from './errors.js'

// Accepts only plain positive integers inside [min, max].
export function intParam(value, name, { min = 1, max = Number.MAX_SAFE_INTEGER, optional = false } = {}) {
  if (value === undefined || value === '') {
    if (optional) return undefined
    throw new AppError('INVALID_PARAMETER', `${name} is required.`, 400)
  }
  if (!/^\d{1,9}$/.test(String(value))) {
    throw new AppError('INVALID_PARAMETER', `${name} must be a whole number.`, 400)
  }
  const n = Number(value)
  if (n < min || n > max) {
    throw new AppError('INVALID_PARAMETER', `${name} must be between ${min} and ${max}.`, 400)
  }
  return n
}
