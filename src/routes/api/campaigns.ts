import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '#/db'
import { campaigns } from '#/db/schema'
import type { CreateCampaignRequest, CreateCampaignResponse } from '#/types'

export const Route = createFileRoute('/api/campaigns')({
  server: {
    handlers: {
      POST: async ({ request }): Promise<CreateCampaignResponse> => {
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

          // TODO: Start extraction pipeline (extract → generate)
          // For now, immediately mark as ready for testing
          // In production: call fetchPageContent + extractBrandProfile + generateAds

          return { id: campaign.id }
        } catch (error) {
          console.error('POST /api/campaigns failed:', error)
          throw new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to create campaign',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
