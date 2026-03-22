import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import Dashboard from './pages/Dashboard'
import AuthPage from './pages/AuthPage'
import { supabase } from './lib/supabase'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <main className="auth-shell">Loading...</main>
  }

  if (!session) {
    return <AuthPage />
  }

  return (
    <Dashboard
      userId={session.user.id}
      userEmail={session.user.email ?? ''}
      onSignOut={handleSignOut}
    />
  )
}

export default App
