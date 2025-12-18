export class WidgetError extends Error {
  public readonly status: number
  public readonly errorCode: string
  public readonly details?: string | undefined

  constructor({
    status,
    errorCode,
    message,
    details
  }: {
    status: number
    errorCode: string
    message: string
    details?: string | undefined
  }) {
    super(message)

    this.name = 'WidgetError'
    this.status = status
    this.errorCode = errorCode
    this.details = details

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (typeof (Error as any).captureStackTrace === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;(Error as any).captureStackTrace(this, WidgetError)
    }
  }

  /**
   * Converts the error to a plain object for serialization
   */
  toJSON(): {
    status: number
    errorCode: string
    message: string
    details?: string | undefined
  } {
    return {
      status: this.status,
      errorCode: this.errorCode,
      message: this.message,
      details: this.details
    }
  }

  /**
   * Creates a WidgetError from a plain object
   */
  static fromJSON(data: {
    status: number
    errorCode: string
    message: string
    details?: string | undefined
  }): WidgetError {
    return new WidgetError(data)
  }
}
