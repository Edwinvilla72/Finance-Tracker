export type UserRole = 'user' | 'admin'

export type Profile = {
  id: string
  email: string | null
  fullName: string | null
  role: UserRole
}
