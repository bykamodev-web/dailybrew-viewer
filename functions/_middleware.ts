const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 60_000

const ipRequests = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = ipRequests.get(ip)

  if (!entry || now > entry.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  entry.count++
  return entry.count <= RATE_LIMIT_MAX
}

function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)

  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' blob: https://cloud.umami.is; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.coingecko.com https://cloud.umami.is; worker-src 'self' blob:; frame-ancestors 'none'"
  )
  headers.set("X-Frame-Options", "DENY")
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("Referrer-Policy", "same-origin")
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  headers.set("X-Robots-Tag", "noindex, nofollow")

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const ip = context.request.headers.get("CF-Connecting-IP") ?? "unknown"

  if (context.request.url.includes("/api/papers/") && !checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded", code: 429 }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      }
    )
  }

  const response = await context.next()
  return addSecurityHeaders(response)
}
