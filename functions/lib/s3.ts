const ALGORITHM = "AWS4-HMAC-SHA256"
const REGION = "auto"
const SERVICE = "s3"

async function hmac(
  key: ArrayBuffer | Uint8Array,
  message: string
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message))
}

async function sha256(data: string | ArrayBuffer): Promise<string> {
  const buffer =
    typeof data === "string" ? new TextEncoder().encode(data) : data
  const hash = await crypto.subtle.digest("SHA-256", buffer)
  return hexEncode(hash)
}

function hexEncode(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function getDateStrings(): { dateStamp: string; amzDate: string } {
  const now = new Date()
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "")
  const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
  return { dateStamp, amzDate }
}

async function getSigningKey(
  secretKey: string,
  dateStamp: string
): Promise<ArrayBuffer> {
  const kDate = await hmac(
    new TextEncoder().encode("AWS4" + secretKey),
    dateStamp
  )
  const kRegion = await hmac(kDate, REGION)
  const kService = await hmac(kRegion, SERVICE)
  return hmac(kService, "aws4_request")
}

interface S3RequestOptions {
  method: string
  path: string
  query?: string
  headers?: Record<string, string>
}

export async function signedS3Request(
  env: Env,
  options: S3RequestOptions
): Promise<Response> {
  const url = new URL(env.R2_ENDPOINT_URL)
  const host = `${env.R2_BUCKET_NAME}.${url.hostname}`
  const fullUrl = `${url.protocol}//${host}${options.path}${options.query ? "?" + options.query : ""}`

  const { dateStamp, amzDate } = getDateStrings()
  const payloadHash = await sha256("")

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date"

  const canonicalRequest = [
    options.method,
    options.path,
    options.query ?? "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join("\n")

  const signingKey = await getSigningKey(env.R2_SECRET_ACCESS_KEY, dateStamp)
  const signatureBuffer = await hmac(signingKey, stringToSign)
  const signature = hexEncode(signatureBuffer)

  const authorization = `${ALGORITHM} Credential=${env.R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return fetch(fullUrl, {
    method: options.method,
    headers: {
      Host: host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
      ...(options.headers ?? {}),
    },
  })
}

export async function listObjects(env: Env): Promise<string[]> {
  const response = await signedS3Request(env, {
    method: "GET",
    path: "/",
    query: "list-type=2&max-keys=1000",
  })

  if (!response.ok) {
    throw new Error(`R2 list failed: ${response.status}`)
  }

  const xml = await response.text()
  const keys: string[] = []
  const regex = /<Key>([^<]+)<\/Key>/g
  let match
  while ((match = regex.exec(xml)) !== null) {
    keys.push(match[1])
  }
  return keys
}

export async function getObject(
  env: Env,
  key: string
): Promise<Response | null> {
  const response = await signedS3Request(env, {
    method: "GET",
    path: `/${encodeURIComponent(key)}`,
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`R2 get failed: ${response.status}`)
  }

  return response
}
