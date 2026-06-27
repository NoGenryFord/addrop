import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core'

export const campaigns = pgTable('campaigns', {
  id: serial().primaryKey(),
  url: text().notNull(),
  // pending → extracting → generating → ready | failed
  status: text().default('pending').notNull(),
  errorMessage: text(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const brandProfiles = pgTable('brand_profiles', {
  id: serial().primaryKey(),
  campaignId: integer('campaign_id')
    .references(() => campaigns.id)
    .notNull(),
  businessDescription: text(),
  targetAudience: text(),
  valueProposition: text(),
  brandTone: text(),
  colorPalette: jsonb('color_palette'),
  candidateImages: jsonb('candidate_images'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const ads = pgTable('ads', {
  id: serial().primaryKey(),
  campaignId: integer('campaign_id')
    .references(() => campaigns.id)
    .notNull(),
  creativeIdea: text(),
  primaryText: text(),
  headline: text(),
  description: text(),
  cta: text(),
  selectedImage: text(),
  status: text().default('ready').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
