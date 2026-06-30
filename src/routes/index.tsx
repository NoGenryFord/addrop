import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { createFileRoute } from '@tanstack/react-router'
import { useCreateCampaign } from '#/hooks/useCampaign'
import { Input } from '#/components/ui/Input'
import { Button } from '#/components/ui/Button'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const createCampaign = useCreateCampaign()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) {
      alert('Please enter a URL')
      return
    }

    try {
      const result = await createCampaign.mutateAsync({ url: url.trim() })
      navigate({ to: `/campaigns/${result.id}` })
    } catch (error) {
      alert(
        `Error: ${error instanceof Error ? error.message : 'Failed to create campaign'}`,
      )
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />

        <p className="island-kicker mb-3">Snaprime</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">
          Website to ads in seconds
        </h1>
        <p className="mb-8 max-w-2xl text-base text-[var(--sea-ink-soft)] sm:text-lg">
          Paste a website URL and instantly get a brand profile with
          ready-to-edit ad creatives. No guessing, no hallucinations — just
          facts from your site.
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 sm:flex-row"
        >
          <Input
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={setUrl}
            disabled={createCampaign.isPending}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={createCampaign.isPending}
            className="whitespace-nowrap"
          >
            {createCampaign.isPending ? 'Creating...' : 'Create Ads'}
          </Button>
        </form>

        {createCampaign.isError && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {createCampaign.error instanceof Error
              ? createCampaign.error.message
              : 'An error occurred'}
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          [
            'Works on any URL',
            'No hard-coded selectors — we extract from any website.',
          ],
          [
            'JS-rendered pages',
            'Heavy JavaScript? We handle it with browser rendering.',
          ],
          [
            'AI extraction',
            'Smart extraction, no hallucinations — only facts from your site.',
          ],
          [
            'Ready-to-edit',
            'Edit any field, swap images, or regenerate single ads.',
          ],
          ['Fully persisted', 'All changes saved. No data loss on refresh.'],
          ['Deploy anywhere', 'Runs on Cloudflare Workers with Neon database.'],
        ].map(([title, desc], index) => (
          <article
            key={title}
            className="island-shell feature-card rise-in rounded-2xl p-5"
            style={{ animationDelay: `${index * 90 + 80}ms` }}
          >
            <h2 className="mb-2 text-base font-semibold text-[var(--sea-ink)]">
              {title}
            </h2>
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">{desc}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
