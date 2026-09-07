import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import Dashboard from './pages/Dashboard'
import AuthPage from './pages/AuthPage'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { fetchProfile } from './services/profileService'
import type { Profile } from './types/profile'
import './App.css'

// debug mode to use without reliance on Supabase (not necessary)
type AppMode = 'local' | 'supabase'

const APP_MODE_STORAGE_KEY = 'finance-tracker-app-mode'

function getInitialAppMode(): AppMode {
  const savedMode = localStorage.getItem(APP_MODE_STORAGE_KEY)

  if (savedMode === 'local' || savedMode === 'supabase') {
    return savedMode
  }

  return isSupabaseConfigured ? 'supabase' : 'local'
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [appMode, setAppMode] = useState<AppMode>(getInitialAppMode)
  const isLocalMode = appMode === 'local'
  const [loading, setLoading] = useState(!isLocalMode && isSupabaseConfigured)

  function handleModeChange(nextMode: AppMode) {
    localStorage.setItem(APP_MODE_STORAGE_KEY, nextMode)
    setAppMode(nextMode)
    setSession(null)
  }

  useEffect(() => {
    if (isLocalMode || !isSupabaseConfigured || !supabase) {
      return
    }

    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return
      }

      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [isLocalMode])

  // The profile carries the role that unlocks the admin feedback inbox.
  const userId = session?.user.id

  useEffect(() => {
    if (!userId || isLocalMode) {
      return
    }

    let active = true

    fetchProfile(userId)
      .then((nextProfile) => {
        if (active) {
          setProfile(nextProfile)
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load profile', error)
      })

    return () => {
      active = false
    }
  }, [isLocalMode, userId])

  async function handleSignOut() {
    await supabase?.auth.signOut()
  }

  if (loading) {
    return <main className="auth-shell">Loading...</main>
  }

  if (isLocalMode) {
    return (
      <Dashboard
        userEmail="Local dev mode"
        appMode={appMode}
        onModeChange={handleModeChange}
      />
    )
  }

  if (!isSupabaseConfigured) {
    return (
      <AuthPage
        appMode={appMode}
        onModeChange={handleModeChange}
        supabaseUnavailable
      />
    )
  }

  if (!session) {
    return <AuthPage appMode={appMode} onModeChange={handleModeChange} />
  }

  return (
    <Dashboard
      key={session.user.id}
      userId={session.user.id}
      userEmail={session.user.email ?? ''}
      appMode={appMode}
      isAdmin={profile?.id === session.user.id && profile.role === 'admin'}
      onModeChange={handleModeChange}
      onSignOut={handleSignOut}
    />
  )
}

export default App
