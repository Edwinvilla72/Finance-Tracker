export type FeedbackType = 'feature' | 'bug' | 'other'

export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'wont_fix'

export type FeedbackItem = {
  id: string
  userId: string
  userEmail: string | null
  type: FeedbackType
  title: string
  description: string
  additionalDetails: string | null
  status: FeedbackStatus
  adminNotes: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

export type NewFeedback = {
  type: FeedbackType
  title: string
  description: string
  additionalDetails: string
}
