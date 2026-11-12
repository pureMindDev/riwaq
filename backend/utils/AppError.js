// An error we expect and know how to describe to the browser.
export class AppError extends Error {
  constructor(code, message, status = 500, { retryAfter } = {}) {
    super(message)
    if (retryAfter) this.retryAfter = retryAfter
    this.code = code
    this.status = status
  }
}
