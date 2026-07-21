export type ApiRequest = {
  method?: string
  query?: Record<string, string | string[] | undefined>
  headers?: Record<string, string | string[] | undefined>
  body?: unknown
  socket?: { remoteAddress?: string }
}

export type ApiResponse = {
  setHeader(name: string, value: string): void
  status(code: number): ApiResponse
  json(body: Record<string, unknown>): void
}

export function applyPrivateJsonHeaders(response: ApiResponse): void {
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Robots-Tag', 'noindex, nofollow')
}
