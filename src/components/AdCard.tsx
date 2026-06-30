import { useState } from 'react'
import type { Ad, BrandProfile } from '#/types'
import { Button } from './ui/Button'
import { Card, CardHeader, CardBody, CardFooter } from './ui/Card'

interface AdCardProps {
  ad: Ad
  brandProfile: BrandProfile | null | undefined
  onUpdateField: (
    field: keyof Omit<
      Ad,
      'id' | 'campaignId' | 'status' | 'createdAt' | 'updatedAt'
    >,
    value: string,
  ) => Promise<void>
  onRegenerate: () => Promise<void>
  isLoading?: boolean
}

export function AdCard({
  ad,
  brandProfile,
  onUpdateField,
  onRegenerate,
  isLoading = false,
}: AdCardProps) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const handleEditStart = (field: string, value: string) => {
    setEditingField(field)
    setEditValue(value || '')
  }

  const handleEditSave = async (field: string) => {
    await onUpdateField(field as any, editValue)
    setEditingField(null)
  }

  const renderEditableField = (
    label: string,
    field: string,
    value: string | null | undefined,
    maxLength?: number,
  ) => {
    const isEditing = editingField === field
    const displayValue = value || '(not set)'

    return (
      <div
        key={field}
        className="mb-4 border-b border-[var(--line)] pb-4 last:border-b-0"
      >
        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
          {label}{' '}
          {maxLength && (
            <span className="text-[var(--sea-ink-soft)]">
              ({maxLength} chars)
            </span>
          )}
        </label>

        {isEditing ? (
          <div className="mt-2 flex gap-2">
            <input
              autoFocus
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value.slice(0, maxLength))}
              maxLength={maxLength}
              className="flex-1 rounded border border-[var(--lagoon-deep)] px-3 py-2 text-[var(--sea-ink)] focus:outline-none"
            />
            <Button
              type="button"
              onClick={() => handleEditSave(field)}
              variant="primary"
              className="px-3"
            >
              Save
            </Button>
            <Button
              type="button"
              onClick={() => setEditingField(null)}
              variant="secondary"
              className="px-3"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <p
            onClick={() => handleEditStart(field, value || '')}
            className="mt-2 cursor-pointer rounded-lg bg-[var(--sand)] p-3 text-[var(--sea-ink)] transition hover:bg-[var(--foam)]"
          >
            {displayValue}
          </p>
        )}

        {maxLength && editingField === field && (
          <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
            {editValue.length}/{maxLength}
          </p>
        )}
      </div>
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <h3 className="text-xl font-bold text-[var(--sea-ink)]">Ad #{ad.id}</h3>
        <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
          Status: {ad.status}
        </p>
      </CardHeader>

      <CardBody>
        {/* Image preview */}
        {ad.selectedImage && (
          <div className="mb-6">
            <img
              src={ad.selectedImage}
              alt="Ad preview"
              className="h-48 w-full rounded-lg object-cover"
            />
          </div>
        )}

        {/* Editable fields */}
        {renderEditableField('Creative Idea', 'creativeIdea', ad.creativeIdea)}
        {renderEditableField('Headline', 'headline', ad.headline, 40)}
        {renderEditableField(
          'Primary Text',
          'primaryText',
          ad.primaryText,
          125,
        )}
        {renderEditableField('Description', 'description', ad.description, 30)}
        {renderEditableField('CTA Button', 'cta', ad.cta)}

        {/* Image picker */}
        {brandProfile?.candidateImages &&
          brandProfile.candidateImages.length > 0 && (
            <div className="mb-4 border-b border-[var(--line)] pb-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
                Change Image
              </label>
              <div className="mt-3 flex gap-3 overflow-x-auto">
                {brandProfile.candidateImages.map((img) => (
                  <button
                    key={img}
                    onClick={() => handleEditSave('selectedImage')}
                    className={`flex-shrink-0 rounded-lg border-2 transition ${
                      ad.selectedImage === img
                        ? 'border-[var(--lagoon-deep)]'
                        : 'border-transparent hover:border-[var(--line)]'
                    }`}
                  >
                    <img
                      src={img}
                      alt="Candidate"
                      className="h-20 w-20 rounded object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
      </CardBody>

      <CardFooter>
        <Button
          onClick={onRegenerate}
          variant="primary"
          disabled={isLoading || ad.status === 'regenerating'}
        >
          {ad.status === 'regenerating' ? 'Regenerating...' : 'Regenerate'}
        </Button>
      </CardFooter>
    </Card>
  )
}
