const COINGECKO_API = "https://api.coingecko.com/api/v3"
const CRYPTO_IDS = ["bitcoin", "ethereum", "hyperliquid"]

function buildXSearchUrl(trend) {
  const keyword = trend.keyword || ""
  if (keyword) {
    return `https://x.com/search?q=${encodeURIComponent(keyword)}&f=live`
  }
  const source = (trend.source || "").replace(/^@/, "")
  return `https://x.com/search?q=${encodeURIComponent(source || trend.headline)}&f=live`
}

function isSafeUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return false
  }
}

export function renderSidebar(container, meta, liveMarket) {
  container.innerHTML = ""

  const inner = document.createElement("div")
  inner.className = "sidebar-inner"

  inner.appendChild(buildSourcesSection(meta))
  inner.appendChild(buildXTrendsSection(meta))
  inner.appendChild(buildMarketSection(meta, liveMarket))

  container.appendChild(inner)
}

function buildSourcesSection(meta) {
  const section = document.createElement("section")
  section.className = "sidebar-section"

  const h2 = document.createElement("h2")
  h2.className = "sidebar-heading"
  h2.textContent = "Sources"
  section.appendChild(h2)

  const sources = meta?.sources ?? []
  if (sources.length === 0) {
    const p = document.createElement("p")
    p.className = "sidebar-empty"
    p.textContent = "ソース情報なし"
    section.appendChild(p)
    return section
  }

  const list = document.createElement("ul")
  list.className = "source-list"

  for (const source of sources) {
    const li = document.createElement("li")
    li.className = "source-item"

    const metaRow = document.createElement("div")
    metaRow.className = "source-meta"

    const category = document.createElement("span")
    category.className = "source-category"
    category.textContent = source.category || ""
    metaRow.appendChild(category)

    const sourceName = document.createElement("span")
    sourceName.className = "source-name"
    sourceName.textContent = source.source_name
    metaRow.appendChild(sourceName)

    li.appendChild(metaRow)

    const headline = document.createElement("a")
    headline.className = "source-link"
    headline.href = isSafeUrl(source.url) ? source.url : "#"
    headline.target = "_blank"
    headline.rel = "noopener noreferrer"
    headline.textContent = source.headline

    const arrow = document.createElement("span")
    arrow.className = "source-arrow"
    arrow.textContent = "\u2197"
    headline.appendChild(arrow)

    li.appendChild(headline)
    list.appendChild(li)
  }

  section.appendChild(list)
  return section
}

function buildXTrendsSection(meta) {
  const section = document.createElement("section")
  section.className = "sidebar-section"

  const h2 = document.createElement("h2")
  h2.className = "sidebar-heading"
  h2.textContent = "X Trends"
  section.appendChild(h2)

  const trends = meta?.x_trends ?? []
  if (trends.length === 0) {
    return section
  }

  const list = document.createElement("div")
  list.className = "xtrend-list"

  for (const trend of trends) {
    const item = document.createElement("a")
    item.className = "xtrend-item"
    item.href = buildXSearchUrl(trend)
    item.target = "_blank"
    item.rel = "noopener noreferrer"

    const header = document.createElement("div")
    header.className = "xtrend-header"

    const headline = document.createElement("span")
    headline.className = "xtrend-headline"
    headline.textContent = trend.headline
    header.appendChild(headline)

    const source = document.createElement("span")
    source.className = "xtrend-source"
    source.textContent = trend.source
    header.appendChild(source)

    const arrow = document.createElement("span")
    arrow.className = "xtrend-arrow"
    arrow.textContent = "\u2197"
    header.appendChild(arrow)

    item.appendChild(header)

    const summary = document.createElement("p")
    summary.className = "xtrend-summary"
    summary.textContent = trend.summary
    item.appendChild(summary)

    list.appendChild(item)
  }

  section.appendChild(list)
  return section
}

function buildMarketSection(meta, liveMarket) {
  const section = document.createElement("section")
  section.className = "sidebar-section"

  const h2 = document.createElement("h2")
  h2.className = "sidebar-heading"
  h2.textContent = "Market"
  section.appendChild(h2)

  const snapMarket = meta?.market ?? []
  const grid = document.createElement("div")
  grid.className = "market-grid"

  for (const item of snapMarket) {
    const card = document.createElement("div")
    card.className = "market-card"

    // Header: symbol + badge
    const header = document.createElement("div")
    header.className = "market-card-header"

    const symbol = document.createElement("span")
    symbol.className = "market-symbol"
    symbol.textContent = item.display
    header.appendChild(symbol)

    const badgeClass = item.is_up === true ? "up" : item.is_up === false ? "down" : "flat"
    const badge = document.createElement("span")
    badge.className = `market-badge ${badgeClass}`
    badge.textContent = item.change_str
    header.appendChild(badge)

    card.appendChild(header)

    // Snap price
    const priceRow = document.createElement("div")
    priceRow.className = "market-price-row"

    const price = document.createElement("span")
    price.className = "market-price-snap"
    price.textContent = item.price
    priceRow.appendChild(price)

    const label = document.createElement("span")
    label.className = "market-price-label"
    label.textContent = "発行時"
    priceRow.appendChild(label)

    card.appendChild(priceRow)

    // Live price
    const live = liveMarket?.[item.display]
    if (live) {
      const liveRow = document.createElement("div")
      liveRow.className = "market-live-row"

      const livePrice = document.createElement("span")
      livePrice.className = "market-price-live"
      livePrice.textContent = live.price
      liveRow.appendChild(livePrice)

      const liveLabel = document.createElement("span")
      liveLabel.className = "market-live-label"
      liveLabel.textContent = "now"
      liveRow.appendChild(liveLabel)

      const liveChange = document.createElement("span")
      liveChange.className = `market-live-change ${live.is_up ? "up" : "down"}`
      liveChange.textContent = live.change_str
      liveRow.appendChild(liveChange)

      card.appendChild(liveRow)
    }

    grid.appendChild(card)
  }

  section.appendChild(grid)
  return section
}

export async function fetchLiveMarket() {
  try {
    const ids = CRYPTO_IDS.join(",")
    const res = await fetch(
      `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
    )
    if (!res.ok) return {}

    const data = await res.json()
    const result = {}

    const displayMap = { bitcoin: "BTC", ethereum: "ETH", hyperliquid: "HYPE" }
    for (const [id, info] of Object.entries(data)) {
      const display = displayMap[id]
      if (!display) continue
      const price = info.usd
      const change = info.usd_24h_change ?? 0
      result[display] = {
        price: price >= 1 ? `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${price.toFixed(4)}`,
        change_str: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
        is_up: change >= 0,
      }
    }

    return result
  } catch {
    return {}
  }
}
