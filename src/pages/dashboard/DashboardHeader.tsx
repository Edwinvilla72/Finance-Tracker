import { AnimatePresence, motion } from 'framer-motion'

import { pageTabs, type PageView } from './dashboardTypes'

type DashboardHeaderProps = {
  activePage: PageView
  appMode?: 'local' | 'supabase'
  navOpen: boolean
  onModeChange?: (mode: 'local' | 'supabase') => void
  onOpenSettings?: () => void
  onPageChange: (page: PageView) => void
  onRetrySave?: () => void
  onSignOut?: () => Promise<void> | void
  onToggleNav: () => void
  saveState?: 'idle' | 'saving' | 'saved' | 'error' | null
  userEmail?: string
}

export function DashboardHeader({
  activePage,
  appMode,
  navOpen,
  onModeChange,
  onOpenSettings,
  onPageChange,
  onRetrySave,
  onSignOut,
  onToggleNav,
  saveState,
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
      {onOpenSettings ? (
        <button type="button" className="nav-quiet" onClick={onOpenSettings}>
          Settings
        </button>
      ) : null}
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

  const syncIndicator =
    saveState === 'error' ? (
      <button
        type="button"
        className="nav-status nav-status-error"
        onClick={onRetrySave}
      >
        Couldn't save - Retry
      </button>
    ) : saveState === 'saving' || saveState === 'saved' ? (
      <span className="nav-status" role="status">
        {saveState === 'saving' ? 'Saving...' : 'Saved'}
      </span>
    ) : null

  return (
    <header className="app-navbar">
      <strong className="navbar-brand" title={userEmail || undefined}>
        Finance Tracker
      </strong>

      <div className="nav-right">
        {syncIndicator}

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
      </div>
    </header>
  )
}
