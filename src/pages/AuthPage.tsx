import { useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type AppMode = 'local' | 'supabase'

type AuthPageProps = {
  appMode: AppMode
  onModeChange: (mode: AppMode) => void
  supabaseUnavailable?: boolean
}

// Supabase reports verification-link problems (expired or already-used links)
// by redirecting back with error details in the URL. Surface them once and
// clean the URL so a refresh does not repeat the message.
function readAuthErrorFromUrl() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(window.location.search)
  const description =
    hashParams.get('error_description') ?? searchParams.get('error_description')

  if (description) {
    window.history.replaceState(null, '', window.location.pathname)
  }

  return description ?? ''
}

function AuthPage({ appMode, onModeChange, supabaseUnavailable = false }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(readAuthErrorFromUrl)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      setMessage('Supabase is not configured. The app is running in local demo mode.')
      return
    }

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Send the verification link back to wherever the app is running,
          // instead of the project-wide default site URL.
          emailRedirectTo: window.location.origin,
        },
      })

      setLoading(false)
      setMessage(
        error
          ? error.message
          : `Check ${email} for a verification link. Opening it brings you back here, signed in.`,
      )
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)
    setMessage(error ? error.message : 'Signed in.')
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Finance tracker</p>
        <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <p className="auth-copy">
          {supabaseUnavailable
            ? 'Supabase mode is selected, but the environment variables are missing on this machine.'
            : mode === 'login'
              ? 'Use your Supabase account to access the shared finance dashboard.'
              : 'Create an account so you and your family can use the app from separate logins.'}
        </p>

        <div className="mode-toggle" aria-label="App mode">
          <button
            type="button"
            className={appMode === 'local' ? 'selected' : ''}
            onClick={() => onModeChange('local')}
          >
            Local dev
          </button>
          <button
            type="button"
            className={appMode === 'supabase' ? 'selected' : ''}
            onClick={() => onModeChange('supabase')}
          >
            Supabase
          </button>
        </div>

        {supabaseUnavailable ? (
          <p className="auth-message">
            Switch to local dev mode to use browser-saved data until your `.env` is back.
          </p>
        ) : null}

        <form className="stack-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Working...' : mode === 'login' ? 'Sign in' : 'Register'}
          </button>
        </form>

        <button
          type="button"
          className="ghost-button auth-toggle"
          onClick={() => {
            setMode((current) => (current === 'login' ? 'register' : 'login'))
            setMessage('')
          }}
        >
          {mode === 'login'
            ? 'Need an account? Register'
            : 'Already have an account? Sign in'}
        </button>

        {message ? <p className="auth-message">{message}</p> : null}
      </section>
    </main>
  )
}

export default AuthPage
