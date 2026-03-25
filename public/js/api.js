const API_BASE = "/api/papers"

export async function fetchPapersList() {
  const res = await fetch(API_BASE)
  if (!res.ok) {
    throw new Error(`Failed to fetch papers list: ${res.status}`)
  }
  const data = await res.json()
  return data.papers
}

export async function fetchPaperBytes(date) {
  const res = await fetch(`${API_BASE}/${date}`)
  if (res.status === 404) {
    return null
  }
  if (res.status === 429) {
    throw new Error("RATE_LIMITED")
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch paper: ${res.status}`)
  }
  return await res.arrayBuffer()
}

export async function fetchPaperMeta(date) {
  try {
    const res = await fetch(`${API_BASE}/${date}/meta`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
