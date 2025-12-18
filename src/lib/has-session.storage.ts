// The SDK keeps a flag in localStorage to track if the user has a valid session
// in the iframe. If it does, we use it to auto connect the parent to the
// iframe.

// Client-specific storage keys for multi-session support
const hasSessionKey = (clientId: string): string => `narval:has-session:${clientId}`
const canUseStorage = (): boolean => typeof window !== 'undefined' && !!window.localStorage

export const setHasSession = (hasSession: boolean, clientId: string): void => {
  if (!canUseStorage()) {
    return
  }
  const key = hasSessionKey(clientId)
  if (hasSession) {
    localStorage.setItem(key, hasSession.toString())
  } else {
    localStorage.removeItem(key)
  }
}

export const hasSession = (clientId: string): boolean => {
  if (!canUseStorage()) {
    return false
  }
  try {
    const key = hasSessionKey(clientId)
    return localStorage.getItem(key) === 'true'
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to read existing session flag', { error })

    return false
  }
}

export const clearHasSession = (clientId: string): void => {
  if (!canUseStorage()) {
    return
  }
  const key = hasSessionKey(clientId)
  localStorage.removeItem(key)
}
