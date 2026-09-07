import { useEffect, useState, type FormEvent } from 'react'

import {
  FEEDBACK_DESCRIPTION_MIN,
  FEEDBACK_TEXT_MAX,
  FEEDBACK_TITLE_MAX,
  FEEDBACK_TITLE_MIN,
  FEEDBACK_TYPES,
  fetchMyFeedback,
  submitFeedback,
  validateFeedback,
  type FeedbackValidationErrors,
} from '../../services/feedbackService'
import type { FeedbackItem, NewFeedback } from '../../types/feedback'
import { FeedbackCard } from './FeedbackCard'

type FeedbackModalProps = {
  userId: string
  closeModal: () => void
}

const emptyForm: NewFeedback = {
  type: 'feature',
  title: '',
  description: '',
  additionalDetails: '',
}

export function FeedbackModal({ userId, closeModal }: FeedbackModalProps) {
  const [form, setForm] = useState<NewFeedback>(emptyForm)
  const [errors, setErrors] = useState<FeedbackValidationErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    fetchMyFeedback(userId)
      .then((rows) => {
        if (!active) {
          return
        }

        setItems(rows)
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (!active) {
          return
        }

        console.error('Failed to load feedback', error)
        setLoadError("Couldn't load your previous feedback.")
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [userId])

  function updateField<Key extends keyof NewFeedback>(key: Key, value: NewFeedback[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => (key in current ? { ...current, [key]: undefined } : current))
    setSuccessMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // Native required/minLength validation runs first; this catches
    // whitespace-only input and mirrors the database constraints.
    const validation = validateFeedback(form)
    setErrors(validation)

    if (Object.values(validation).some(Boolean)) {
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const created = await submitFeedback(userId, form)
      setItems((current) => [created, ...current])
      setForm(emptyForm)
      setSuccessMessage('Thanks! Your feedback was sent. You can follow its status below.')
    } catch (error) {
      console.error('Failed to submit feedback', error)
      setSubmitError("Couldn't send your feedback. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="modal-header">
        <div>
          <h1>Feedback</h1>
        </div>
        <button type="button" className="ghost-button" onClick={closeModal}>
          Close
        </button>
      </div>

      <form className="stack-form" onSubmit={handleSubmit}>
        <div className="field-stack">
          <span>Category</span>
          <div className="choice-row" role="radiogroup" aria-label="Feedback type">
            {FEEDBACK_TYPES.map((option) => (
              <button
                type="button"
                key={option.value}
                role="radio"
                aria-checked={form.type === option.value}
                className={`weekday-chip choice-chip ${form.type === option.value ? 'selected' : ''
                  }`}
                onClick={() => updateField('type', option.value)}
              >
                <strong>{option.label}</strong>
                <span>{option.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="field-stack">
          <span>Title (required)</span>
          <input
            type="text"
            required
            minLength={FEEDBACK_TITLE_MIN}
            maxLength={FEEDBACK_TITLE_MAX}
            placeholder={
              form.type === 'bug'
                ? 'The problem you encountered...'
                : 'What you would like to see...'
            }
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            aria-invalid={Boolean(errors.title)}
          />
          {errors.title ? <span className="form-error">{errors.title}</span> : null}
        </label>

        <label className="field-stack">
          <span>Description (required)</span>
          <textarea
            required
            rows={4}
            minLength={FEEDBACK_DESCRIPTION_MIN}
            maxLength={FEEDBACK_TEXT_MAX}
            placeholder={
              form.type === 'bug'
                ? 'What were you doing, what did you expect, and what happened instead?'
                : 'Describe what you\'d like to see...'
            }
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
            aria-invalid={Boolean(errors.description)}
          />
          <span className="field-help">
            At least {FEEDBACK_DESCRIPTION_MIN} characters · {form.description.trim().length}/
            {FEEDBACK_TEXT_MAX}
          </span>
          {errors.description ? <span className="form-error">{errors.description}</span> : null}
        </label>

        <label className="field-stack">
          <span>Additional details (optional)</span>
          <textarea
            rows={3}
            maxLength={FEEDBACK_TEXT_MAX}
            value={form.additionalDetails}
            onChange={(event) => updateField('additionalDetails', event.target.value)}
          />
          {errors.additionalDetails ? (
            <span className="form-error">{errors.additionalDetails}</span>
          ) : null}
        </label>

        {submitError ? <p className="form-error">{submitError}</p> : null}
        {successMessage ? <div className="callout callout-positive">{successMessage}</div> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send feedback'}
        </button>
      </form>

      <div className="modal-list compact-list">
        {loading ? (
          <p className="empty-copy">Loading your feedback...</p>
        ) : loadError ? (
          <p className="form-error">{loadError}</p>
        ) : (
          <div className="feedback-list">
            {items.map((item) => (
              <FeedbackCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
