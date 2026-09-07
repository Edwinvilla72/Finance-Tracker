import { useEffect, useState } from 'react'

import {
  FEEDBACK_STATUSES,
  FEEDBACK_TEXT_MAX,
  FEEDBACK_TYPES,
  fetchAllFeedback,
  updateFeedbackNotes,
  updateFeedbackStatus,
} from '../../services/feedbackService'
import type { FeedbackItem, FeedbackStatus, FeedbackType } from '../../types/feedback'
import { FeedbackCard } from './FeedbackCard'
import { feedbackStatusTones } from './statusTones'

type AdminFeedbackModalProps = {
  closeModal: () => void
}

type StatusFilter = 'all' | FeedbackStatus
type TypeFilter = 'all' | FeedbackType

export function AdminFeedbackModal({ closeModal }: AdminFeedbackModalProps) {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    fetchAllFeedback()
      .then((rows) => {
        if (!active) {
          return
        }

        setItems(rows)
        setLoading(false)
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return
        }

        console.error('Failed to load feedback', loadError)
        setError("Couldn't load feedback. Close this window and try again.")
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const itemsForType =
    typeFilter === 'all' ? items : items.filter((item) => item.type === typeFilter)
  const statusCounts = FEEDBACK_STATUSES.reduce<Record<FeedbackStatus, number>>(
    (counts, status) => {
      counts[status.value] = itemsForType.filter((item) => item.status === status.value).length
      return counts
    },
    { open: 0, in_progress: 0, resolved: 0, wont_fix: 0 },
  )
  const visibleItems =
    statusFilter === 'all'
      ? itemsForType
      : itemsForType.filter((item) => item.status === statusFilter)

  function replaceItem(updated: FeedbackItem) {
    setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
  }

  async function changeStatus(item: FeedbackItem, status: FeedbackStatus) {
    if (item.status === status || busyId) {
      return
    }

    const previousStatus = item.status
    setBusyId(item.id)
    setError(null)
    replaceItem({ ...item, status })

    try {
      replaceItem(await updateFeedbackStatus(item.id, status))
    } catch (updateError) {
      console.error('Failed to update feedback status', updateError)
      replaceItem({ ...item, status: previousStatus })
      setError("Couldn't update the status. Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  async function saveNote(item: FeedbackItem) {
    const draft = noteDrafts[item.id]

    if (draft === undefined || busyId) {
      return
    }

    setBusyId(item.id)
    setError(null)

    try {
      replaceItem(await updateFeedbackNotes(item.id, draft))
      setNoteDrafts((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
      setSavedNoteId(item.id)
      window.setTimeout(() => {
        setSavedNoteId((current) => (current === item.id ? null : current))
      }, 2500)
    } catch (updateError) {
      console.error('Failed to save admin note', updateError)
      setError("Couldn't save the note. Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="modal-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Feedback inbox</h2>
        </div>
        <button type="button" className="ghost-button" onClick={closeModal}>
          Close
        </button>
      </div>

      <div className="feedback-toolbar">
        <div className="nav-segmented" aria-label="Filter by status">
          <button
            type="button"
            className={`nav-pill ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All<span className="chip-count">{itemsForType.length}</span>
          </button>
          {FEEDBACK_STATUSES.map((status) => (
            <button
              type="button"
              key={status.value}
              className={`nav-pill ${statusFilter === status.value ? 'active' : ''}`}
              onClick={() => setStatusFilter(status.value)}
              title={status.description}
            >
              {status.label}
              <span className="chip-count">{statusCounts[status.value]}</span>
            </button>
          ))}
        </div>

        <select
          className="select-inline"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          {FEEDBACK_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {loading ? (
        <p className="empty-copy">Loading feedback...</p>
      ) : visibleItems.length === 0 ? (
        <p className="empty-copy">
          {items.length === 0
            ? 'No feedback has been submitted yet.'
            : 'Nothing matches these filters.'}
        </p>
      ) : (
        <div className="feedback-list">
          {visibleItems.map((item) => {
            const noteValue = noteDrafts[item.id] ?? item.adminNotes ?? ''
            const noteChanged =
              noteDrafts[item.id] !== undefined && noteDrafts[item.id] !== (item.adminNotes ?? '')
            const busy = busyId === item.id

            return (
              <FeedbackCard key={item.id} item={item} showSubmitter showAdminNotes={false}>
                <div className="admin-controls">
                  <div className="status-actions" aria-label={`Set status for ${item.title}`}>
                    {FEEDBACK_STATUSES.map((status) => (
                      <button
                        type="button"
                        key={status.value}
                        className={`status-action tone-${feedbackStatusTones[status.value]} ${
                          item.status === status.value ? 'selected' : ''
                        }`}
                        disabled={busy}
                        onClick={() => void changeStatus(item, status.value)}
                        title={status.description}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>

                  <div className="admin-note-form">
                    <span className="feedback-label">Note to the submitter (optional)</span>
                    <textarea
                      rows={2}
                      maxLength={FEEDBACK_TEXT_MAX}
                      placeholder="Let them know what you decided, or when it shipped."
                      value={noteValue}
                      onChange={(event) =>
                        setNoteDrafts((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                      aria-label={`Admin note for ${item.title}`}
                    />
                    <div className="row-actions">
                      <span className="feedback-meta">
                        {savedNoteId === item.id
                          ? 'Note saved'
                          : noteChanged
                            ? 'Unsaved changes'
                            : ''}
                      </span>
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={busy || !noteChanged}
                        onClick={() => void saveNote(item)}
                      >
                        Save note
                      </button>
                    </div>
                  </div>
                </div>
              </FeedbackCard>
            )
          })}
        </div>
      )}
    </>
  )
}
