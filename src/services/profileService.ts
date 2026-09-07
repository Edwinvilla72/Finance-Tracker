import { supabase } from '../lib/supabase'
import type { Profile } from '../types/profile'

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
}

// The profile row is created by a database trigger on signup; role defaults to
// 'user' and can only be changed with `npm run db:promote-admin`.
export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  const row = data as ProfileRow

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role === 'admin' ? 'admin' : 'user',
  }
}
