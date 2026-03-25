import { getObject } from "../../../lib/s3"

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(date: string): boolean {
  if (!VALID_DATE.test(date)) return false
  const d = new Date(date + "T00:00:00Z")
  return !isNaN(d.getTime()) && d.toISOString().startsWith(date)
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const date = context.params.date as string

  if (!isValidDate(date)) {
    return new Response(
      JSON.stringify({ error: "Invalid date format", code: 400 }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    const r2Response = await getObject(context.env, `${date}.json`)

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
