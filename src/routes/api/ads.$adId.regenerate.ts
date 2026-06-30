import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '#/db'
import { ads } from '#/db/schema'
import { eq } from 'drizzle-orm'
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

          // TODO: Get brand profile from campaign
          // TODO: Call generateOneAd(profile, existingAds)
          // TODO: Update ad with new values
          // TODO: Set status back to 'ready'

          // For now, immediately set to ready
          await db.update(ads).set({ status: 'ready' }).where(eq(ads.id, adId))

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
