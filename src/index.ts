import { listObjects, getObject } from "./s3"

interface Env {
  R2_ENDPOINT_URL: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_BUCKET_NAME: string
  ASSETS: Fetcher
}

// --- Rate limiting ---
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

// --- Security headers ---
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

// --- Date validation ---
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}\.pdf$/

function isValidDate(date: string): boolean {
  if (!VALID_DATE.test(date)) return false
  const d = new Date(date + "T00:00:00Z")
  return !isNaN(d.getTime()) && d.toISOString().startsWith(date)
}

// --- Route handlers ---
async function handlePapersList(env: Env): Promise<Response> {
  try {
    const keys = await listObjects(env)

    const papers = keys
      .filter((key) => DATE_PATTERN.test(key))
      .map((key) => key.replace(".pdf", ""))
      .sort()
      .reverse()

    return new Response(JSON.stringify({ papers }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch {
    return new Response(
      JSON.stringify({ error: "Internal server error", code: 500 }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

async function handlePaperPdf(env: Env, date: string): Promise<Response> {
  if (!isValidDate(date)) {
    return new Response(
      JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD", code: 400 }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    const r2Response = await getObject(env, `${date}.pdf`)

    if (!r2Response) {
      return new Response(
        JSON.stringify({ error: "Not found", code: 404 }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response(r2Response.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=604800, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new Response(
      JSON.stringify({ error: "Internal server error", code: 500 }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

async function handlePaperMeta(env: Env, date: string): Promise<Response> {
  if (!isValidDate(date)) {
    return new Response(
      JSON.stringify({ error: "Invalid date format", code: 400 }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    const r2Response = await getObject(env, `${date}.json`)

    if (!r2Response) {
      return new Response(
        JSON.stringify({ error: "Not found", code: 404 }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    const body = await r2Response.text()
    return new Response(body, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch {
    return new Response(
      JSON.stringify({ error: "Internal server error", code: 500 }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

// --- Router ---
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Rate limiting for API routes
    if (path.startsWith("/api/papers/")) {
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown"
      if (!checkRateLimit(ip)) {
        return addSecurityHeaders(
          new Response(
            JSON.stringify({ error: "Rate limit exceeded", code: 429 }),
            {
              status: 429,
              headers: { "Content-Type": "application/json", "Retry-After": "60" },
            }
          )
        )
      }
    }

    let response: Response

    // API routing
    if (path === "/api/papers" || path === "/api/papers/") {
      response = await handlePapersList(env)
    } else if (path.match(/^\/api\/papers\/[\d-]+\/meta$/)) {
      const date = path.split("/")[3]
      response = await handlePaperMeta(env, date)
    } else if (path.match(/^\/api\/papers\/[\d-]+$/)) {
      const date = path.split("/")[3]
      response = await handlePaperPdf(env, date)
    } else {
      // Serve static assets via ASSETS binding
      // Rewrite / to /index.html
      const assetUrl = new URL(request.url)
      if (assetUrl.pathname === "/" || assetUrl.pathname === "") {
        assetUrl.pathname = "/index.html"
      }
      response = await env.ASSETS.fetch(new Request(assetUrl.toString(), request))
    }

    return addSecurityHeaders(response)
  },
} satisfies ExportedHandler<Env>
