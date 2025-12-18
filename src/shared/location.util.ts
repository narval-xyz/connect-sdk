export const removeSearchParams = (paramOrParamsToRemove: string | string[]): void => {
  let paramsToRemove: string[]

  if (typeof paramOrParamsToRemove === 'string') {
    paramsToRemove = [paramOrParamsToRemove]
  } else {
    paramsToRemove = paramOrParamsToRemove
  }

  const searchParams = new URLSearchParams(window.location.search)

  for (const param of paramsToRemove) {
    searchParams.delete(param)
  }

  window.history.replaceState(
    {},
    '',
    `${window.location.pathname}${searchParams.size === 0 ? '' : `?${searchParams.toString()}`}`
  )
}
