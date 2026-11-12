// An error we expect and know how to describe to the browser.
export class AppError extends Error {
  constructor(code, message, status = 500) {
    super(message)
    this.code = code
    this.status = status
  }
}
