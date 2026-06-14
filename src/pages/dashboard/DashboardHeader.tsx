import { AnimatePresence, motion } from 'framer-motion'

import { pageTabs, type PageView } from './dashboardTypes'

type DashboardHeaderProps = {
  activePage: PageView
  appMode?: 'local' | 'supabase'
  navOpen: boolean
  onModeChange?: (mode: 'local' | 'supabase') => void
  onPageChange: (page: PageView) => void
  onSignOut?: () => Promise<void> | void
  onToggleNav: () => void
  userEmail?: string
}

export function DashboardHeader({
  activePage,
  appMode,
  navOpen,
  onModeChange,
  onPageChange,
  onSignOut,
  onToggleNav,
  userEmail,
}: DashboardHeaderProps) {
  const handleModeToggle = () => {
    if (!onModeChange) {
      return
    }

    onModeChange(appMode === 'local' ? 'supabase' : 'local')
  }

  return (
    <header className="app-navbar">
      <div className="navbar-brand">
        <p className="eyebrow">Finance tracker</p>
        <strong>{userEmail ? `Planner · ${userEmail}` : 'Planner'}</strong>
        <span className="mode-badge">{appMode === 'local' ? 'Local dev' : 'Supabase'}</span>
      </div>

      <button
        type="button"
        className="icon-button navbar-toggle"
        onClick={onToggleNav}
        aria-label="Toggle navigation"
      >
        <span />
        <span />
        <span />
      </button>

      <AnimatePresence initial={false}>
        {navOpen ? (
          <motion.nav
            className="app-nav is-open"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {pageTabs.map((tab) => (
              <button
                type="button"
                className={`nav-pill ${activePage === tab.value ? 'active' : ''}`}
                key={tab.value}
                onClick={() => onPageChange(tab.value)}
              >
                {tab.label}
              </button>
            ))}
            {onModeChange ? (
              <button type="button" className="nav-pill" onClick={handleModeToggle}>
                {appMode === 'local' ? 'Use Supabase' : 'Use local dev'}
              </button>
            ) : null}
            {onSignOut ? (
              <button type="button" className="nav-pill" onClick={() => void onSignOut()}>
                Sign out
              </button>
            ) : null}
          </motion.nav>
        ) : null}
      </AnimatePresence>

      <nav className="app-nav desktop-nav">
        {pageTabs.map((tab) => (
          <button
            type="button"
            className={`nav-pill ${activePage === tab.value ? 'active' : ''}`}
            key={tab.value}
            onClick={() => onPageChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
        {onModeChange ? (
          <button type="button" className="nav-pill" onClick={handleModeToggle}>
            {appMode === 'local' ? 'Use Supabase' : 'Use local dev'}
          </button>
        ) : null}
        {onSignOut ? (
          <button type="button" className="nav-pill" onClick={() => void onSignOut()}>
            Sign out
          </button>
        ) : null}
      </nav>
    </header>
  )
}
