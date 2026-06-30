import { createFileRoute } from '@tanstack/react-router'
import { useNavigate } from '@tanstack/react-router'
import { useCampaign, useUpdateAd, useRegenerateAd } from '#/hooks/useCampaign'
import { StatusProgress } from '#/components/StatusProgress'
import { BrandProfileCard } from '#/components/BrandProfileCard'
import { AdCard } from '#/components/AdCard'
import { Button } from '#/components/ui/Button'

export const Route = createFileRoute('/campaigns/$campaignId')({
  component: CampaignPage,
})

function CampaignPage() {
  const { campaignId } = Route.useParams()
  const navigate = useNavigate()
  const campaignId_num = Number(campaignId)

  const { data, isLoading, error } = useCampaign(campaignId_num)
  const updateAd = useUpdateAd()
  const regenerateAd = useRegenerateAd()

  if (isLoading) {
    return (
      <main className="page-wrap px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--lagoon-deep)] border-t-transparent animate-spin" />
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="page-wrap px-4 py-8">
        <div className="rounded-lg bg-red-50 p-6 text-red-700">
          <h1 className="text-2xl font-bold">Failed to load campaign</h1>
          <p className="mt-2">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <Button
            onClick={() => navigate({ to: '/' })}
            variant="primary"
            className="mt-4"
          >
            Back to home
          </Button>
        </div>
      </main>
    )
  }

  const { campaign, brandProfile, ads } = data

  return (
    <main className="page-wrap px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--sea-ink)]">Campaign</h1>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">URL: {campaign.url}</p>
        </div>
        <Button
          onClick={() => navigate({ to: '/' })}
          variant="secondary"
        >
          ← New campaign
        </Button>
      </div>

      {campaign.status === 'failed' && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
          <p className="font-semibold">Failed to process this URL</p>
          {campaign.errorMessage && <p className="mt-1 text-sm">{campaign.errorMessage}</p>}
        </div>
      )}

      <StatusProgress campaign={campaign} />

      {brandProfile && <BrandProfileCard profile={brandProfile} />}

      {ads.length > 0 && (
        <div>
          <h2 className="mb-6 text-2xl font-bold text-[var(--sea-ink)]">Ad Creatives</h2>
          {ads.map((ad) => (
            <AdCard
              key={ad.id}
              ad={ad}
              brandProfile={brandProfile}
              onUpdateField={async (field, value) => {
                await updateAd.mutateAsync({ adId: ad.id, field, value })
              }}
              onRegenerate={async () => {
                await regenerateAd.mutateAsync(ad.id)
              }}
              isLoading={regenerateAd.isPending}
            />
          ))}
        </div>
      )}

      {ads.length === 0 && campaign.status === 'ready' && (
        <div className="rounded-lg bg-[var(--foam)] p-6 text-center">
          <p className="text-[var(--sea-ink-soft)]">No ads generated yet.</p>
        </div>
      )}
    </main>
  )
}
