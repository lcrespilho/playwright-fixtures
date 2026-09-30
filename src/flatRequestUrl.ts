export type RequestLike = {
  url: () => string
  postData: () => string | null
}

/**
 * Returns a flattened request URL by combining the URL and postData parameters of the given Request-like object.
 */
export const flatRequestUrl = (req: RequestLike): string => {
  const url = req.url()
  const body = req.postData()
  if (!body) return url
  const flatUrl = `${url}${url.includes('?') ? '&' : '?'}${body}`
  return flatUrl
    .replace(/\r\n|\n|\r/g, '&')
    .replace(/&&/g, '&')
    .replace(/&$/g, '')
}
