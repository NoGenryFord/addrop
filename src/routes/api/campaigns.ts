import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '#/db'
import { campaigns, brandProfiles, ads } from '#/db/schema'
import { eq } from 'drizzle-orm'
import { fetchPageContent } from '#/lib/scraper'
import { extractBrandProfile } from '#/lib/extractor'
import { generateAds } from '#/lib/adGenerator'
import type { CreateCampaignRequest } from '#/types'

export const Route = createFileRoute('/api/campaigns')({
  server: {
    handlers: {
      POST: async ({ request }): Promise<Response> => {
        try {
          const { url } = (await request.json()) as CreateCampaignRequest

          // Basic URL validation
          if (!url || typeof url !== 'string') {
            throw new Error('Invalid URL')
          }

          try {
            new URL(url)
          } catch {
            throw new Error('Invalid URL format')
          }

          const db = getDb()
          const [campaign] = await db
            .insert(campaigns)
            .values({
              url,
              status: 'pending',
            })
            .returning()

          // Run extraction + generation pipeline synchronously
          try {
            // Step 1: Fetch page content
            console.log(`[API] Fetching content for ${url}`)
            const content = await fetchPageContent(url)
            console.log(
              `[API] Content fetched (${content.text.length} chars, ${content.images.length} images, source: ${content.sourceMethod})`,
            )

            // Step 2: Extract brand profile
            console.log(`[API] Extracting brand profile...`)
            const { profile, tokenUsage: extractorTokens } =
              await extractBrandProfile(content)
            console.log(
              `[API] Brand profile extracted (tokens: ${extractorTokens.input} + ${extractorTokens.output})`,
            )

            // Save brand profile
            await db
              .insert(brandProfiles)
              .values({
                campaignId: campaign.id,
                businessDescription: profile.businessDescription,
                targetAudience: profile.targetAudience,
                valueProposition: profile.valueProposition,
                brandTone: profile.brandTone,
                colorPalette: profile.colorPalette,
                candidateImages: profile.candidateImages,
              })
              .returning()

            // Step 3: Generate ads
            console.log(`[API] Generating ads...`)
            const { ads: generatedAds, tokenUsage: generatorTokens } =
              await generateAds(campaign.id, profile)
            console.log(
              `[API] Generated ${generatedAds.length} ads (tokens: ${generatorTokens.input} + ${generatorTokens.output})`,
            )

            // Save ads
            await db.insert(ads).values(
              generatedAds.map((ad) => ({
                campaignId: campaign.id,
                creativeIdea: ad.creativeIdea,
                primaryText: ad.primaryText,
                headline: ad.headline,
                description: ad.description,
                cta: ad.cta,
                selectedImage: ad.selectedImage,
                status: 'ready' as const,
              })),
            )

            // Update campaign status
            await db
              .update(campaigns)
              .set({
                status: 'ready',
                updatedAt: new Date(),
              })
              .where(eq(campaigns.id, campaign.id))

            console.log(`[API] Campaign ${campaign.id} completed successfully`)
          } catch (error) {
            // Update campaign with error
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error'
            console.error(`[API] Campaign ${campaign.id} failed:`, errorMessage)

            await db
              .update(campaigns)
              .set({
                status: 'failed',
                errorMessage,
                updatedAt: new Date(),
              })
              .where(eq(campaigns.id, campaign.id))

            throw error
          }

          return Response.json({ id: campaign.id })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to create campaign'
          console.error('[API] POST /api/campaigns failed:', message)
          return new Response(JSON.stringify({ error: message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
