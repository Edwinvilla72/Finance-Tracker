import { plaidRequest, readBankSnapshot, syncPlaidItem } from '../_shared/plaid.ts'
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
    const { publicToken, institution } = (await req.json()) as {
      publicToken?: string
      institution?: {
        institution_id?: string | null
        name?: string | null
      } | null
    }

    if (!publicToken) {
      return jsonResponse({ error: 'Missing public token.' }, { status: 400 })
    }

    const exchangeResponse = await plaidRequest<{
      access_token: string
      item_id: string
    }>('/item/public_token/exchange', {
      public_token: publicToken,
    })

    const upsertPayload = {
      user_id: user.id,
      plaid_item_id: exchangeResponse.item_id,
      access_token: exchangeResponse.access_token,
      institution_id: institution?.institution_id ?? null,
      institution_name: institution?.name ?? null,
      updated_at: new Date().toISOString(),
    }

    const { data: itemRows, error: upsertError } = await adminClient
      .from('plaid_items')
      .upsert(upsertPayload, { onConflict: 'plaid_item_id' })
      .select(
        'id,user_id,plaid_item_id,access_token,institution_name,last_transactions_cursor',
      )
      .limit(1)

    if (upsertError || !itemRows?.[0]) {
      throw new Error(upsertError?.message ?? 'Failed to store linked bank item.')
    }

    await syncPlaidItem(adminClient, itemRows[0])
    const snapshot = await readBankSnapshot(adminClient, user.id)

    return jsonResponse(snapshot)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Failed to link bank account.' },
      { status: 500 },
    )
  }
})
