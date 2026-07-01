import { z } from 'zod'
import type { BrandProfileOutput } from './extractor'
import type { Ad } from '#/types'

/**
 * Single ad schema — Zod validates each ad.
 */
const adSchema = z.object({
  creativeIdea: z.string().describe('One sentence creative concept for the ad'),
  primaryText: z.string().max(125).describe('Main ad body text (≤125 chars)'),
  headline: z.string().max(40).describe('Eye-catching headline (≤40 chars)'),
  description: z.string().max(30).describe('Short supporting text (≤30 chars)'),
  cta: z
    .string()
    .describe('Call-to-action button text, e.g. "Shop Now", "Learn More"'),
  selectedImageIndex: z
    .number()
    .describe('Index of image from candidateImages array'),
})

/**
 * Ads array schema
 */
const adsSchema = z.object({
  ads: z.array(adSchema).min(1).max(3).describe('1-3 ad creatives'),
})

export type AdOutput = z.infer<typeof adSchema>

/**
 * Generate 1-3 ad creatives from brand profile (using Groq free tier).
 *
 * Flow:
 * 1. Format brand profile + candidate images for AI
 * 2. Call Groq API (free — no credit card)
 * 3. Parse JSON response
 * 4. Map to Ad type (add IDs, timestamps, status)
 * 5. Log token usage
 *
 * Why multiple ads?
 * - Gives user choices
 * - Different angles work for different audiences
 * - Better for A/B testing
 */
export async function generateAds(
  campaignId: number,
  profile: BrandProfileOutput,
  existingAds: Ad[] = [],
): Promise<{ ads: Ad[]; tokenUsage: { input: number; output: number } }> {
  const existingConcepts = existingAds
    .map((ad) => ad.creativeIdea)
    .filter(Boolean)
    .join('\n')

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY not set. Get free key from https://console.groq.com/keys (no credit card needed)',
    )
  }

  const systemPrompt = `You are a creative ad copywriter. Generate Facebook/Instagram ad copy.

CRITICAL RULES:
- Only use facts from the brand profile
- Do NOT invent features, prices, or claims
- Match the brand tone (${profile.brandTone})
- Create distinct creative angles — each ad must be different
- Keep text concise and benefit-focused
- ${existingConcepts ? `Do NOT repeat these concepts:\n${existingConcepts}` : 'Generate unique creative angles'}

You MUST respond with ONLY valid JSON (no markdown, no code blocks, just raw JSON).`

  const userPrompt = `Generate ad creatives for this brand:

Business: ${profile.businessDescription}
Target Audience: ${profile.targetAudience}
Value Proposition: ${profile.valueProposition}
Tone: ${profile.brandTone}

Available images (${profile.candidateImages.length} total):
${profile.candidateImages.map((img, i) => `${i}. ${img}`).join('\n')}

Create 1-3 distinct ad concepts with different angles. Each ad should appeal to the target audience and match the brand tone.

Return this JSON structure (no markdown):
{
  "ads": [
    {
      "creativeIdea": "string",
      "primaryText": "string (max 125 chars)",
      "headline": "string (max 40 chars)",
      "description": "string (max 30 chars)",
      "cta": "string",
      "selectedImageIndex": 0
    }
  ]
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
          temperature: 0.7, // Higher for creative variation
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

    const { ads: adOutputs } = JSON.parse(jsonText) as z.infer<typeof adsSchema>
    const inputTokens = data.usage?.prompt_tokens ?? 0
    const outputTokens = data.usage?.completion_tokens ?? 0

    console.log(
      `[AdGenerator] Generated ${adOutputs.length} ads. Tokens: ${inputTokens} in, ${outputTokens} out`,
    )

    // Map to Ad type with IDs, timestamps, status
    const ads: Ad[] = adOutputs.map((ad, index) => {
      // Validate image index
      const imageIndex = Math.max(
        0,
        Math.min(ad.selectedImageIndex, profile.candidateImages.length - 1),
      )
      const selectedImage =
        profile.candidateImages[imageIndex] ||
        profile.candidateImages[0] ||
        null

      return {
        id: -(index + 1), // Temporary negative ID (will be replaced by DB insert)
        campaignId,
        creativeIdea: ad.creativeIdea,
        primaryText: ad.primaryText.slice(0, 125),
        headline: ad.headline.slice(0, 40),
        description: ad.description.slice(0, 30),
        cta: ad.cta,
        selectedImage,
        status: 'ready' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })

    return {
      ads,
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
      },
    }
  } catch (error) {
    console.error('[AdGenerator] Failed to generate ads:', error)
    throw new Error(
      error instanceof Error ? error.message : 'Failed to generate ads',
    )
  }
}

/**
 * Generate a single ad (used for "Regenerate" button).
 * Takes existing ads to avoid repeating concepts.
 */
export async function generateOneAd(
  campaignId: number,
  profile: BrandProfileOutput,
  existingAds: Ad[],
): Promise<{ ad: Ad; tokenUsage: { input: number; output: number } }> {
  const { ads, tokenUsage } = await generateAds(
    campaignId,
    profile,
    existingAds,
  )
  return { ad: ads[0], tokenUsage }
}
