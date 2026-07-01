import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '#/db'
import { ads } from '#/db/schema'
import { eq } from 'drizzle-orm'
import type { UpdateAdRequest } from '#/types'

export const Route = createFileRoute('/api/ads/$adId')({
  server: {
    handlers: {
      PUT: async ({ params, request }): Promise<Response> => {
        try {
          const adId = Number(params.adId)
          const { field, value } = (await request.json()) as UpdateAdRequest

          if (!adId || !field || value === undefined) {
            throw new Error('Invalid request')
          }

          const db = getDb()

          // Validate field name to prevent injection
          const allowedFields = [
            'creativeIdea',
            'primaryText',
            'headline',
            'description',
            'cta',
            'selectedImage',
          ] as const

          if (!allowedFields.includes(field as any)) {
            throw new Error(`Invalid field: ${field}`)
          }

          await db
            .update(ads)
            .set({
              [field]: value,
              updatedAt: new Date(),
            })
            .where(eq(ads.id, adId))

          return Response.json({ ok: true })
        } catch (error) {
          console.error('PUT /api/ads/:id failed:', error)
          throw new Response(
            JSON.stringify({
              error:
                error instanceof Error ? error.message : 'Failed to update ad',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
