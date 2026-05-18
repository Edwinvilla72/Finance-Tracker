import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import Dashboard from './pages/Dashboard'
import AuthPage from './pages/AuthPage'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import './App.css'

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
  const [loading, setLoading] = useState(true)
  const [appMode, setAppMode] = useState<AppMode>(getInitialAppMode)
  const isLocalMode = appMode === 'local'

  function handleModeChange(nextMode: AppMode) {
    localStorage.setItem(APP_MODE_STORAGE_KEY, nextMode)
    setAppMode(nextMode)
    setSession(null)
  }

  useEffect(() => {
    if (isLocalMode || !isSupabaseConfigured || !supabase) {
      setLoading(false)
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
      userId={session.user.id}
      userEmail={session.user.email ?? ''}
      appMode={appMode}
      onModeChange={handleModeChange}
      onSignOut={handleSignOut}
    />
  )
}

export default App
