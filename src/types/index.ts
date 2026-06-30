// Campaign — one URL submission
export interface Campaign {
  id: number
  url: string
  status: 'pending' | 'extracting' | 'generating' | 'ready' | 'failed'
  errorMessage?: string | null
  createdAt: Date
  updatedAt: Date
}

// Brand Profile — extracted AI profile from page content
export interface BrandProfile {
  id: number
  campaignId: number
  businessDescription: string | null
  targetAudience: string | null
  valueProposition: string | null
  brandTone: string | null
  colorPalette: string[] | null // Array of HEX colors
  candidateImages: string[] | null // Array of image URLs
  createdAt: Date
}

// Ad — single ad creative
export interface Ad {
  id: number
  campaignId: number
  creativeIdea: string | null
  primaryText: string | null
  headline: string | null
  description: string | null
  cta: string | null
  selectedImage: string | null
  status: 'ready' | 'regenerating'
  createdAt: Date
  updatedAt: Date
}

// API Response types
export interface CreateCampaignRequest {
  url: string
}

export interface CreateCampaignResponse {
  id: number
}

export interface GetCampaignResponse {
  campaign: Campaign
  brandProfile: BrandProfile | null
  ads: Ad[]
}

export interface UpdateAdRequest {
  field: keyof Omit<
    Ad,
    'id' | 'campaignId' | 'status' | 'createdAt' | 'updatedAt'
  >
  value: string
}

export interface UpdateAdResponse {
  ok: boolean
}

export interface RegenerateAdRequest {}

export interface RegenerateAdResponse {
  ok: boolean
}
