import { readBankSnapshot, syncAllPlaidItems } from '../_shared/plaid.ts'
import {
  corsHeaders,
  createAdminClient,
  jsonResponse,
  requireUser,
} from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const user = await requireUser(req)
    const adminClient = createAdminClient()

    await syncAllPlaidItems(adminClient, user.id)
    const snapshot = await readBankSnapshot(adminClient, user.id)

    return jsonResponse(snapshot)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Failed to sync bank data.' },
      { status: 500 },
    )
  }
})
