declare global {
  interface Window {
    Plaid?: {
      create: (config: {
        token: string
        onSuccess: (
          publicToken: string,
          metadata: {
            institution?: {
              institution_id?: string | null
              name?: string | null
            } | null
          },
        ) => void
        onExit?: (error: unknown) => void
      }) => {
        open: () => void
        exit: () => void
        destroy: () => void
      }
    }
  }
}

export {}
