import { listObjects } from "../../lib/s3"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}\.pdf$/

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const keys = await listObjects(context.env)

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
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
