import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '#/db'
import { ads, campaigns, brandProfiles } from '#/db/schema'
import { eq } from 'drizzle-orm'
import { generateOneAd } from '#/lib/adGenerator'
import type { RegenerateAdResponse } from '#/types'

export const Route = createFileRoute('/api/ads/$adId/regenerate')({
  server: {
    handlers: {
      POST: async ({ params }): Promise<RegenerateAdResponse> => {
        try {
          const adId = Number(params.adId)

          if (!adId) {
            throw new Error('Invalid ad ID')
          }

          const db = getDb()

          // Mark as regenerating
          await db
            .update(ads)
            .set({ status: 'regenerating' })
            .where(eq(ads.id, adId))

          // Get the ad to find its campaign
          const ad = await db.query.ads.findFirst({
            where: eq(ads.id, adId),
          })

          if (!ad) {
            throw new Error('Ad not found')
          }

          const campaignId = ad.campaignId

          // Get brand profile for this campaign
          const profile = await db.query.brandProfiles.findFirst({
            where: eq(brandProfiles.campaignId, campaignId),
          })

          if (!profile) {
            throw new Error('Brand profile not found')
          }

          // Get existing ads to avoid repeating concepts
          const existingAds = await db.query.ads.findMany({
            where: eq(ads.campaignId, campaignId),
          })

          // Generate new ad
          console.log(
            `[Regenerate] Generating new ad for campaign ${campaignId}`,
          )
          const { ad: newAd } = await generateOneAd(
            campaignId,
            profile as any,
            existingAds as any,
          )

          // Update the ad with new content
          await db
            .update(ads)
            .set({
              creativeIdea: newAd.creativeIdea,
              primaryText: newAd.primaryText,
              headline: newAd.headline,
              description: newAd.description,
              cta: newAd.cta,
              selectedImage: newAd.selectedImage,
              status: 'ready' as const,
              updatedAt: new Date(),
            })
            .where(eq(ads.id, adId))

          console.log(`[Regenerate] Ad ${adId} regenerated successfully`)

          return { ok: true }
        } catch (error) {
          console.error('POST /api/ads/:id/regenerate failed:', error)
          throw new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to regenerate ad',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
