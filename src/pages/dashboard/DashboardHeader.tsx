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

  const secondaryActions = (
    <>
      {onModeChange ? (
        <button type="button" className="nav-quiet" onClick={handleModeToggle}>
          {appMode === 'local' ? 'Use Supabase' : 'Use local data'}
        </button>
      ) : null}
      {onSignOut ? (
        <button type="button" className="nav-quiet" onClick={() => void onSignOut()}>
          Sign out
        </button>
      ) : null}
    </>
  )

  return (
    <header className="app-navbar">
      <strong className="navbar-brand" title={userEmail || undefined}>
        Finance Tracker
      </strong>

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
            {secondaryActions}
          </motion.nav>
        ) : null}
      </AnimatePresence>

      <nav className="app-nav desktop-nav">
        <div className="nav-segmented">
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
        </div>
        {secondaryActions}
      </nav>
    </header>
  )
}
