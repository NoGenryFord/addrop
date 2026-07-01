import { load } from 'cheerio'

export interface ScrapedContent {
  title: string
  text: string
  images: string[]
  metaDescription: string
  sourceMethod: 'fetch' | 'firecrawl' | 'fallback'
}

/**
 * Fetch page content with JS-rendering fallback.
 *
 * Flow:
 * 1. Plain fetch() with browser User-Agent
 * 2. Parse HTML with cheerio
 * 3. If text < 500 chars → JS-rendered shell → call Firecrawl API
 * 4. If Firecrawl unavailable → return partial result with sourceMethod='fallback'
 */
export async function fetchPageContent(url: string): Promise<ScrapedContent> {
  try {
    // Step 1: Plain fetch with browser User-Agent
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()

    // Step 2: Parse with cheerio
    const parsed = parseHtml(html)

    // Step 3: Check if JS-rendered (too little text)
    const isJsRendered = parsed.text.length < 500

    if (isJsRendered && process.env.FIRECRAWL_API_KEY) {
      console.log(`[Scraper] Detected JS-rendered page, calling Firecrawl for ${url}`)
      try {
        const firecrawlResult = await fetchWithFirecrawl(url)
        return { ...firecrawlResult, sourceMethod: 'firecrawl' }
      } catch (error) {
        console.warn(`[Scraper] Firecrawl failed, using fallback`, error)
        return { ...parsed, sourceMethod: 'fallback' }
      }
    }

    return { ...parsed, sourceMethod: 'fetch' }
  } catch (error) {
    console.error(`[Scraper] Failed to fetch ${url}:`, error)
    throw new Error(
      error instanceof Error
        ? `Failed to fetch page: ${error.message}`
        : 'Failed to fetch page content'
    )
  }
}

/**
 * Parse HTML with cheerio.
 * Extract: title, text, images, metaDescription
 */
function parseHtml(html: string): Omit<ScrapedContent, 'sourceMethod'> {
  const $ = load(html)

  // Title
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').text() ||
    ''

  // Meta description
  const metaDescription =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    ''

  // Remove script, style, nav, footer tags (they add noise)
  $('script, style, nav, footer, noscript').remove()

  // Extract text
  let text = $('body').text() || ''
  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .slice(0, 10000) // Cap at 10k chars to avoid excessive tokens

  // Extract images
  const images: string[] = []
  const baseUrl = extractBaseUrl(html)

  // og:image first (usually hero/logo)
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage) {
    images.push(makeAbsoluteUrl(ogImage, baseUrl))
  }

  // twitter:image
  const twitterImage = $('meta[name="twitter:image"]').attr('content')
  if (twitterImage && !images.includes(twitterImage)) {
    images.push(makeAbsoluteUrl(twitterImage, baseUrl))
  }

  // <img> tags with src and alt (filter out tiny icons)
  $('img[src]').each((_, elem) => {
    const src = $(elem).attr('src') || ''
    const alt = $(elem).attr('alt') || ''
    const width = $(elem).attr('width')
    const height = $(elem).attr('height')

    // Skip very small images (likely icons, badges)
    if ((width && Number(width) < 100) || (height && Number(height) < 100)) {
      return
    }

    // Skip if alt text is empty (often decorative)
    if (alt.trim().length === 0) {
      return
    }

    const absoluteUrl = makeAbsoluteUrl(src, baseUrl)

    // Skip data URIs and duplicates
    if (!absoluteUrl.startsWith('data:') && !images.includes(absoluteUrl)) {
      images.push(absoluteUrl)
    }
  })

  return {
    title: title.slice(0, 200), // Cap title
    text,
    images: images.slice(0, 10), // Max 10 images
    metaDescription,
  }
}

/**
 * Call Firecrawl API to render JS-heavy pages.
 * Firecrawl handles browser rendering, JavaScript execution, etc.
 */
async function fetchWithFirecrawl(url: string): Promise<Omit<ScrapedContent, 'sourceMethod'>> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY not set')
  }

  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'metadata'],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Firecrawl API error: ${response.status} ${error}`)
  }

  const data = (await response.json()) as any

  // Firecrawl returns markdown + metadata
  const markdown = data.markdown || ''
  const metadata = data.metadata || {}

  // Extract images from Firecrawl response (usually in og:image or page screenshots)
  const images: string[] = []
  if (metadata.og_image) {
    images.push(metadata.og_image)
  }
  if (metadata.imgLinks) {
    images.push(...metadata.imgLinks.slice(0, 9)) // Max 10 total
  }

  return {
    title: metadata.title || metadata.og_title || '',
    text: markdown.slice(0, 10000),
    images: images.slice(0, 10),
    metaDescription: metadata.description || metadata.og_description || '',
  }
}

/**
 * Extract base URL from HTML (used to make image URLs absolute)
 */
function extractBaseUrl(html: string): string {
  const baseMatch = html.match(/<base\s+href=["']([^"']+)["']/i)
  if (baseMatch) {
    return baseMatch[1]
  }

  // Fallback: extract domain from first <a> href or <link> href
  const linkMatch = html.match(/(?:href|src)=["']([^"']+\/\/[^/]+)/i)
  if (linkMatch) {
    try {
      const url = new URL(linkMatch[1])
      return url.origin
    } catch {
      return ''
    }
  }

  return ''
}

/**
 * Convert relative URLs to absolute
 */
function makeAbsoluteUrl(url: string, baseUrl: string): string {
  if (!url) return ''

  // Already absolute
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  // Data URI
  if (url.startsWith('data:')) {
    return url
  }

  // Relative path
  if (!baseUrl) {
    return url // Can't make absolute without base URL
  }

  try {
    return new URL(url, baseUrl).href
  } catch {
    return url
  }
}
