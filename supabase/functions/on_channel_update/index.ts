import type { UpdatePayload } from '../_utils/supabase.ts'
import { supabaseAdmin } from '../_utils/supabase.ts'
import type { Database } from '../_utils/supabase.types.ts'
import { getEnv, sendRes } from '../_utils/utils.ts'
import { redisAppVersionInvalidate } from '../_utils/redis.ts'

// Generate a v4 UUID. For this we use the browser standard `crypto.randomUUID`
// function.
Deno.serve(async (event: Request) => {
  const API_SECRET = getEnv('API_SECRET')
  const authorizationSecret = event.headers.get('apisecret')
  if (!authorizationSecret || !API_SECRET || authorizationSecret !== API_SECRET)
    return sendRes({ message: 'Fail Authorization' }, 400)

  try {
    const table: keyof Database['public']['Tables'] = 'channels'
    const body = (await event.json()) as UpdatePayload<typeof table>
    if (body.table !== table) {
      console.log(`Not ${table}`)
      return sendRes({ message: `Not ${table}` }, 200)
    }
    if (body.type !== 'UPDATE') {
      console.log('Not UPDATE')
      return sendRes({ message: 'Not UPDATE' }, 200)
    }
    const record = body.record
    console.log('record', record)

    if (record.public && record.ios) {
      const { error: iosError } = await supabaseAdmin()
        .from('channels')
        .update({ public: false })
        .eq('app_id', record.app_id)
        .eq('ios', true)
        .neq('id', record.id)
      const { error: hiddenError } = await supabaseAdmin()
        .from('channels')
        .update({ public: false })
        .eq('app_id', record.app_id)
        .eq('android', false)
        .eq('ios', false)
      if (iosError || hiddenError)
        console.log('error', iosError || hiddenError)
    }

    if (record.public && record.android) {
      const { error: androidError } = await supabaseAdmin()
        .from('channels')
        .update({ public: false })
        .eq('app_id', record.app_id)
        .eq('android', true)
        .neq('id', record.id)
      const { error: hiddenError } = await supabaseAdmin()
        .from('channels')
        .update({ public: false })
        .eq('app_id', record.app_id)
        .eq('android', false)
        .eq('ios', false)
      if (androidError || hiddenError)
        console.log('error', androidError || hiddenError)
    }

    if (record.public && (record.ios === record.android)) {
      const { error } = await supabaseAdmin()
        .from('channels')
        .update({ public: false })
        .eq('app_id', record.app_id)
        .eq('public', true)
        .neq('id', record.id)
      if (error)
        console.log('error', error)
    }

    // Invalidate cache
    if (!record.app_id) {
      return sendRes({
        status: 'error app_id',
        error: 'Np app id included the request',
      }, 500)
    }

    await redisAppVersionInvalidate(record.app_id)

    return sendRes()
  }
  catch (e) {
    console.log('Error', e)
    return sendRes({
      status: 'Error unknow',
      error: JSON.stringify(e),
    }, 500)
  }
})
