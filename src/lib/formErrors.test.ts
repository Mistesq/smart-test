import { describe, expect, it, vi } from 'vitest'
import { ApiError, GENERIC_ERROR_MESSAGE, NetworkError } from '../api/errors.ts'
import { applyFormError, FORM_ERROR_KEY, mapFormError } from './formErrors.ts'

const FIELDS = ['email', 'password'] as const

function validationError(fieldErrors?: Record<string, string[]>): ApiError {
  return new ApiError({ status: 422, type: 'ValidationException', message: 'The given data was invalid.', fieldErrors })
}

describe('mapFormError', () => {
  it('puts the first message of each known field under that field', () => {
    const error = validationError({ password: ['These credentials do not match our records.', 'Second.'] })

    expect(mapFormError(error, FIELDS)).toEqual({
      fieldErrors: { password: 'These credentials do not match our records.' },
      formError: null,
    })
  })

  it('shows errors for fields the form does not have at form level', () => {
    const error = validationError({ email: ['Bad email.'], fingerprint: ['Bad fingerprint.'] })

    expect(mapFormError(error, FIELDS)).toEqual({
      fieldErrors: { email: 'Bad email.' },
      formError: 'Bad fingerprint.',
    })
  })

  it('shows the error message for a 422 without field errors', () => {
    expect(mapFormError(validationError(), FIELDS)).toEqual({
      fieldErrors: {},
      formError: 'The given data was invalid.',
    })
  })

  it.each([
    ['a non-422 API error', new ApiError({ status: 400, type: 'BadRequestException', message: 'Bad.' }), 'Bad.'],
    ['a network error', new NetworkError(new TypeError('offline')), new NetworkError(null).message],
    ['an unexpected error', new Error('stack details'), GENERIC_ERROR_MESSAGE],
    ['a thrown non-error value', 'boom', GENERIC_ERROR_MESSAGE],
  ])('shows %s at form level', (_, error, message) => {
    expect(mapFormError(error, FIELDS)).toEqual({ fieldErrors: {}, formError: message })
  })
})

describe('applyFormError', () => {
  it('sets field errors and the form error on react-hook-form', () => {
    const setError = vi.fn()

    applyFormError(validationError({ password: ['Wrong.'], fingerprint: ['Bad.'] }), FIELDS, setError)

    expect(setError).toHaveBeenCalledTimes(2)
    expect(setError).toHaveBeenCalledWith('password', { type: 'server', message: 'Wrong.' })
    expect(setError).toHaveBeenCalledWith(FORM_ERROR_KEY, { type: 'server', message: 'Bad.' })
  })
})
