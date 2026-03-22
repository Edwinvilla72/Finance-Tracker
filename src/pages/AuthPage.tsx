import { useState } from 'react'
import { supabase } from '../lib/supabase'

function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      setLoading(false)
      setMessage(
        error ? error.message : 'Registration submitted. Check your email if confirmation is enabled.',
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
          {mode === 'login'
            ? 'Use your Supabase account to access the shared finance dashboard.'
            : 'Create an account so you and your family can use the app from separate logins.'}
        </p>

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
