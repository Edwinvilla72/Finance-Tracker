import { supabase } from '../lib/supabase'
import type {
  FeedbackItem,
  FeedbackStatus,
  FeedbackType,
  NewFeedback,
} from '../types/feedback'

const FEEDBACK_TABLE = 'feedback'

export const FEEDBACK_STATUSES: { value: FeedbackStatus; label: string; description: string }[] = [
  { value: 'open', label: 'Open', description: 'New, not reviewed yet' },
  { value: 'in_progress', label: 'In progress', description: 'Being worked on' },
  { value: 'resolved', label: 'Resolved', description: 'Shipped or fixed' },
  { value: 'wont_fix', label: "Won't fix", description: 'Reviewed and declined' },
]

export const FEEDBACK_TYPES: { value: FeedbackType; label: string; hint: string }[] = [
  { value: 'feature', label: 'Feature request', hint: 'Something new you would like' },
  { value: 'bug', label: 'Bug / fix', hint: 'Something is broken or wrong' },
  { value: 'other', label: 'Other', hint: 'Questions, ideas, anything else' },
]

export const FEEDBACK_TITLE_MIN = 3
export const FEEDBACK_TITLE_MAX = 120
export const FEEDBACK_DESCRIPTION_MIN = 10
export const FEEDBACK_TEXT_MAX = 4000

export function feedbackStatusLabel(status: FeedbackStatus) {
  return FEEDBACK_STATUSES.find((entry) => entry.value === status)?.label ?? status
}

export function feedbackTypeLabel(type: FeedbackType) {
  return FEEDBACK_TYPES.find((entry) => entry.value === type)?.label ?? type
}

export type FeedbackValidationErrors = {
  title?: string
  description?: string
  additionalDetails?: string
}

// Mirrors the check constraints on the feedback table so the user sees a clear
// message before the request is sent.
export function validateFeedback(input: NewFeedback): FeedbackValidationErrors {
  const errors: FeedbackValidationErrors = {}
  const title = input.title.trim()
  const description = input.description.trim()

  if (title.length === 0) {
    errors.title = 'Please add a short title.'
  } else if (title.length < FEEDBACK_TITLE_MIN) {
    errors.title = `The title needs at least ${FEEDBACK_TITLE_MIN} characters.`
  } else if (title.length > FEEDBACK_TITLE_MAX) {
    errors.title = `Keep the title under ${FEEDBACK_TITLE_MAX} characters.`
  }

  if (description.length === 0) {
    errors.description = 'Please describe the request or the problem.'
  } else if (description.length < FEEDBACK_DESCRIPTION_MIN) {
    errors.description = `The description needs at least ${FEEDBACK_DESCRIPTION_MIN} characters.`
  } else if (description.length > FEEDBACK_TEXT_MAX) {
    errors.description = `Keep the description under ${FEEDBACK_TEXT_MAX} characters.`
  }

  if (input.additionalDetails.trim().length > FEEDBACK_TEXT_MAX) {
    errors.additionalDetails = `Keep additional details under ${FEEDBACK_TEXT_MAX} characters.`
  }

  return errors
}

type FeedbackRow = {
  id: string
  user_id: string
  feedback_type: FeedbackType
  title: string
  description: string
  additional_details: string | null
  status: FeedbackStatus
  admin_notes: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  profiles?: { email: string | null } | { email: string | null }[] | null
}

const FEEDBACK_COLUMNS =
  'id, user_id, feedback_type, title, description, additional_details, status, admin_notes, created_at, updated_at, resolved_at'
const FEEDBACK_COLUMNS_WITH_SUBMITTER = `${FEEDBACK_COLUMNS}, profiles (email)`

function assertSupabase() {
  if (!supabase) {
    throw new Error('Feedback needs a signed-in Supabase session.')
  }

  return supabase
}

function mapFeedback(row: FeedbackRow): FeedbackItem {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles

  return {
    id: row.id,
    userId: row.user_id,
    userEmail: profile?.email ?? null,
    type: row.feedback_type,
    title: row.title,
    description: row.description,
    additionalDetails: row.additional_details,
    status: row.status,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  }
}

export async function submitFeedback(userId: string, input: NewFeedback): Promise<FeedbackItem> {
  const { data, error } = await assertSupabase()
    .from(FEEDBACK_TABLE)
    .insert({
      user_id: userId,
      feedback_type: input.type,
      title: input.title.trim(),
      description: input.description.trim(),
      additional_details: input.additionalDetails.trim() || null,
    })
    .select(FEEDBACK_COLUMNS)
    .single()

  if (error) {
    throw error
  }

  return mapFeedback(data as FeedbackRow)
}

export async function fetchMyFeedback(userId: string): Promise<FeedbackItem[]> {
  const { data, error } = await assertSupabase()
    .from(FEEDBACK_TABLE)
    .select(FEEDBACK_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as FeedbackRow[]).map(mapFeedback)
}

// Row level security returns every row for admins and only the caller's own
// rows for anyone else, so this is safe to call without a role check.
export async function fetchAllFeedback(): Promise<FeedbackItem[]> {
  const { data, error } = await assertSupabase()
    .from(FEEDBACK_TABLE)
    .select(FEEDBACK_COLUMNS_WITH_SUBMITTER)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as unknown as FeedbackRow[]).map(mapFeedback)
}

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
): Promise<FeedbackItem> {
  const { data, error } = await assertSupabase()
    .from(FEEDBACK_TABLE)
    .update({ status })
    .eq('id', id)
    .select(FEEDBACK_COLUMNS_WITH_SUBMITTER)
    .single()

  if (error) {
    throw error
  }

  return mapFeedback(data as unknown as FeedbackRow)
}

export async function updateFeedbackNotes(id: string, notes: string): Promise<FeedbackItem> {
  const { data, error } = await assertSupabase()
    .from(FEEDBACK_TABLE)
    .update({ admin_notes: notes.trim() || null })
    .eq('id', id)
    .select(FEEDBACK_COLUMNS_WITH_SUBMITTER)
    .single()

  if (error) {
    throw error
  }

  return mapFeedback(data as unknown as FeedbackRow)
}

export async function countOpenFeedback(): Promise<number> {
  const { count, error } = await assertSupabase()
    .from(FEEDBACK_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')

  if (error) {
    throw error
  }

  return count ?? 0
}
