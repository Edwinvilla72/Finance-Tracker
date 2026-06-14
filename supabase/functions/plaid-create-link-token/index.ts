import { plaidRequest } from '../_shared/plaid.ts'
import { corsHeaders, jsonResponse, requireUser } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const user = await requireUser(req)
    const response = await plaidRequest<{ link_token: string; expiration: string }>(
      '/link/token/create',
      {
        client_name: 'Finance Tracker',
        country_codes: ['US'],
        language: 'en',
        products: ['transactions'],
        user: {
          client_user_id: user.id,
        },
      },
    )

    return jsonResponse({
      linkToken: response.link_token,
      expiration: response.expiration,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Failed to create link token.' },
      { status: 500 },
    )
  }
})
