import mongoose from 'mongoose'
import { AppError } from './AppError.js'

const bad = (message) => new AppError('INVALID_PARAMETER', message, 400)

// Accepts only plain positive integers inside [min, max].
export function intParam(value, name, { min = 1, max = Number.MAX_SAFE_INTEGER, optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return undefined
    throw bad(`${name} is required.`)
  }
  if (!/^\d{1,9}$/.test(String(value))) throw bad(`${name} must be a whole number.`)
  const n = Number(value)
  if (n < min || n > max) throw bad(`${name} must be between ${min} and ${max}.`)
  return n
}

export function enumParam(value, name, allowed, { optional = false } = {}) {
  if (value === undefined && optional) return undefined
  if (!allowed.includes(value)) throw bad(`${name} must be one of: ${allowed.join(', ')}.`)
  return value
}

export function stringParam(value, name, { min = 1, max = 200, trim = true } = {}) {
  if (typeof value !== 'string') throw bad(`${name} is required.`)
  const v = trim ? value.trim() : value
  if (v.length < min || v.length > max) throw bad(`${name} must be ${min}-${max} characters.`)
  return v
}

export function objectIdParam(value, name = 'id') {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value) || String(new mongoose.Types.ObjectId(value)) !== value) {
    throw new AppError('INVALID_PARAMETER', `${name} is not valid.`, 400)
  }
  return value
}

export function bodyObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('A JSON body is required.')
  return body
}
