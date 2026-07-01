import { z } from 'zod'
import type { ScrapedContent } from './scraper'

/**
 * Brand profile schema — Zod validates AI output.
 * This prevents hallucinations by forcing AI to follow exact structure.
 */
const brandProfileSchema = z.object({
  businessDescription: z
    .string()
    .describe(
      'What the company/website does in 1-2 sentences. Only facts from the page. Say "not found" if unclear.',
    ),
  targetAudience: z
    .string()
    .describe(
      'Who this product/service is for. Only from page content. Say "not found" if not stated.',
    ),
  valueProposition: z
    .string()
    .describe(
      'Main value or benefit. What makes them unique. Only facts from page. Say "not found" if not clear.',
    ),
  brandTone: z
    .string()
    .describe(
      'Tone of voice: professional, friendly, bold, playful, minimal, casual, etc. Say "unknown" if unclear.',
    ),
  colorPalette: z
    .array(z.string())
    .max(5)
    .describe(
      'Array of HEX colors from the page: logo, primary buttons, backgrounds. Empty array if none found.',
    ),
  candidateImages: z
    .array(z.string())
    .max(10)
    .describe(
      'Best image URLs for ads: product shots, hero images, lifestyle photos. Not tiny icons or avatars. Return URLs from the scraper result.',
    ),
})

export type BrandProfileOutput = z.infer<typeof brandProfileSchema>

/**
 * Extract brand profile from scraped content using AI (Groq free tier).
 *
 * Flow:
 * 1. Truncate content to 8000 chars (Groq limit)
 * 2. Call Groq API (free tier — no credit card needed)
 * 3. Parse JSON response
 * 4. Log token usage
 * 5. Return structured BrandProfile
 *
 * Why Groq? Free, very fast, no credit card needed. Uses Mixtral 8x7B which is good for extraction.
 * Why Zod? Forces valid JSON, prevents hallucinations via schema.
 */
export async function extractBrandProfile(
  content: ScrapedContent,
): Promise<{
  profile: BrandProfileOutput
  tokenUsage: { input: number; output: number }
}> {
  // Truncate to 8000 chars to avoid excessive token usage
  const truncatedText = content.text.slice(0, 8000)

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY not set. Get free key from https://console.groq.com/keys (no credit card needed)',
    )
  }

  const systemPrompt = `You are a brand analyst. Extract brand information from the provided website content.

CRITICAL RULES:
- Only use facts present in the provided content
- If information is not found, say "not found"
- Do NOT invent facts, features, or claims
- Do NOT assume the target audience
- Do NOT add colors unless clearly stated on the page
- Do NOT guess at tone — infer from word choice and design language

You MUST respond with ONLY valid JSON (no markdown, no code blocks, just raw JSON).`

  const userPrompt = `Extract brand profile from this website content:

Title: ${content.title}
Description: ${content.metaDescription}

Content:
${truncatedText}

Images found: ${content.images.length} total
${content.images
  .slice(0, 5)
  .map((img, i) => `${i + 1}. ${img}`)
  .join('\n')}

Return this JSON structure (no markdown):
{
  "businessDescription": "string",
  "targetAudience": "string",
  "valueProposition": "string",
  "brandTone": "string",
  "colorPalette": ["hex", "colors"],
  "candidateImages": ["urls"]
}`

  try {
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.3, // Low temperature for factual extraction
          max_tokens: 512,
        }),
      },
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Groq API error: ${response.status} ${error}`)
    }

    const data = (await response.json()) as any
    const textContent = data.choices?.[0]?.message?.content

    if (!textContent) {
      throw new Error('No text response from Groq API')
    }

    // Parse JSON (try to extract from markdown code blocks if present)
    let jsonText = textContent
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1]
    }

    // Clean up markdown if present
    jsonText = jsonText.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const profile = JSON.parse(jsonText) as BrandProfileOutput
    const inputTokens = data.usage?.prompt_tokens ?? 0
    const outputTokens = data.usage?.completion_tokens ?? 0

    console.log(
      `[Extractor] Extracted brand profile. Tokens: ${inputTokens} in, ${outputTokens} out`,
    )

    // Pass through candidate images from scraper (AI might not extract all)
    const allImages = [
      ...new Set([...profile.candidateImages, ...content.images]),
    ]

    return {
      profile: {
        ...profile,
        candidateImages: allImages.slice(0, 10),
      },
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
      },
    }
  } catch (error) {
    console.error('[Extractor] Failed to extract brand profile:', error)
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to extract brand profile',
    )
  }
}
