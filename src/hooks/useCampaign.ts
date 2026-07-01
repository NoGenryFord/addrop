import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CreateCampaignRequest,
  CreateCampaignResponse,
  GetCampaignResponse,
  UpdateAdRequest,
} from '#/types'

const API_BASE = '/api'

// Fetch campaign + profile + ads
async function fetchCampaign(id: number): Promise<GetCampaignResponse> {
  const response = await fetch(`${API_BASE}/campaigns/${id}`)
  if (!response.ok) throw new Error('Failed to fetch campaign')
  return response.json()
}

// Create new campaign
async function createCampaign(req: CreateCampaignRequest): Promise<CreateCampaignResponse> {
  const response = await fetch(`${API_BASE}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!response.ok) throw new Error('Failed to create campaign')
  return response.json()
}

// Update ad field
async function updateAd(adId: number, req: UpdateAdRequest): Promise<void> {
  const response = await fetch(`${API_BASE}/ads/${adId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!response.ok) throw new Error('Failed to update ad')
}

// Regenerate single ad
async function regenerateAd(adId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/ads/${adId}/regenerate`, {
    method: 'POST',
  })
  if (!response.ok) throw new Error('Failed to regenerate ad')
}

// Hook: Create campaign + redirect
export function useCreateCampaign() {
  return useMutation({
    mutationFn: createCampaign,
  })
}

// Hook: Fetch campaign with polling
export function useCampaign(campaignId: number | null) {
  return useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => (campaignId ? fetchCampaign(campaignId) : Promise.reject('No ID')),
    enabled: !!campaignId,
    // Poll every 2 seconds while status !== 'ready'
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data?.campaign) return false
      return data.campaign.status === 'ready' ? false : 2000
    },
  })
}

// Hook: Update ad field
export function useUpdateAd() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ adId, ...req }: UpdateAdRequest & { adId: number }) =>
      updateAd(adId, req as UpdateAdRequest),
    onSuccess: () => {
      // Refetch all campaign queries
      queryClient.invalidateQueries({ queryKey: ['campaign'] })
    },
  })
}

// Hook: Regenerate ad
export function useRegenerateAd() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: regenerateAd,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign'] })
    },
  })
}
