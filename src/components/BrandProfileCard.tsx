import type { BrandProfile } from '#/types'
import { Card, CardHeader, CardBody } from './ui/Card'

interface BrandProfileCardProps {
  profile: BrandProfile | null | undefined
}

export function BrandProfileCard({ profile }: BrandProfileCardProps) {
  if (!profile) {
    return null
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="text-2xl font-bold text-[var(--sea-ink)]">
          Brand Profile
        </h2>
      </CardHeader>
      <CardBody className="space-y-4">
        {profile.businessDescription && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--sea-ink-soft)] uppercase tracking-wide">
              What They Do
            </h3>
            <p className="mt-1 text-[var(--sea-ink)]">
              {profile.businessDescription}
            </p>
          </div>
        )}

        {profile.targetAudience && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--sea-ink-soft)] uppercase tracking-wide">
              Target Audience
            </h3>
            <p className="mt-1 text-[var(--sea-ink)]">
              {profile.targetAudience}
            </p>
          </div>
        )}

        {profile.valueProposition && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--sea-ink-soft)] uppercase tracking-wide">
              Value Proposition
            </h3>
            <p className="mt-1 text-[var(--sea-ink)]">
              {profile.valueProposition}
            </p>
          </div>
        )}

        {profile.brandTone && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--sea-ink-soft)] uppercase tracking-wide">
              Brand Tone
            </h3>
            <p className="mt-1 text-[var(--sea-ink)]">{profile.brandTone}</p>
          </div>
        )}

        {profile.colorPalette && profile.colorPalette.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--sea-ink-soft)] uppercase tracking-wide">
              Color Palette
            </h3>
            <div className="mt-2 flex gap-3">
              {profile.colorPalette.map((color) => (
                <div key={color} className="relative" title={color}>
                  <div
                    className="h-12 w-12 rounded-lg border border-[var(--line)] shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="absolute -bottom-6 left-0 text-xs font-mono text-[var(--sea-ink-soft)]">
                    {color}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
