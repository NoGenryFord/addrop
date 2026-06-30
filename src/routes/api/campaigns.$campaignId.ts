import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '#/db'
import { campaigns, brandProfiles, ads } from '#/db/schema'
import { eq } from 'drizzle-orm'
import type { GetCampaignResponse } from '#/types'

export const Route = createFileRoute('/api/campaigns/$campaignId')({
  server: {
    handlers: {
      GET: async ({ params }): Promise<GetCampaignResponse> => {
        try {
          const campaignId = Number(params.campaignId)

          if (!campaignId) {
            throw new Response('Invalid campaign ID', { status: 400 })
          }

          const db = getDb()

          const campaign = await db.query.campaigns.findFirst({
            where: eq(campaigns.id, campaignId),
          })

          if (!campaign) {
            throw new Response('Campaign not found', { status: 404 })
          }

          const brandProfile = await db.query.brandProfiles.findFirst({
            where: eq(brandProfiles.campaignId, campaignId),
          })

          const campaignAds = await db.query.ads.findMany({
            where: eq(ads.campaignId, campaignId),
          })

          return {
            campaign: campaign as any,
            brandProfile: brandProfile as any,
            ads: campaignAds as any,
          }
        } catch (error) {
          if (error instanceof Response) {
            throw error
          }
          console.error('GET /api/campaigns/:id failed:', error)
          throw new Response(
            JSON.stringify({ error: 'Failed to fetch campaign' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
