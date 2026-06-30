import type { Campaign } from '#/types'

interface StatusProgressProps {
  campaign: Campaign
}

const statusMessages = {
  pending: 'Starting...',
  extracting: 'Reading your website...',
  generating: 'Creating ad concepts...',
  ready: 'Done!',
  failed: 'Failed to process',
}

export function StatusProgress({ campaign }: StatusProgressProps) {
  if (campaign.status === 'ready' || campaign.status === 'failed') {
    return null
  }

  const message =
    statusMessages[campaign.status as keyof typeof statusMessages] ||
    'Processing...'

  return (
    <div className="mb-6 rounded-lg bg-[var(--foam)] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 items-center justify-center">
          <div className="h-4 w-4 rounded-full border-2 border-[var(--lagoon-deep)] border-t-transparent animate-spin" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--sea-ink)]">{message}</p>
          <p className="text-xs text-[var(--sea-ink-soft)]">
            Status: <span className="font-mono">{campaign.status}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
