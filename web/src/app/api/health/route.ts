import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SECRET_KEY ?? ''

  try {
    const { count, error } = await getSupabaseAdmin()
      .from('trades')
      .select('*', { count: 'exact', head: true })

    if (error) {
      return Response.json({
        ok: false,
        env: {
          urlOk: url.startsWith('https://'),
          keyOk: key.startsWith('sb_secret_'),
          keyLength: key.length,
        },
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
      }, { status: 500 })
    }

    return Response.json({ ok: true, trades: count })
  } catch (e) {
    return Response.json({
      ok: false,
      env: {
        urlOk: url.startsWith('https://'),
        keyOk: key.startsWith('sb_secret_'),
        keyLength: key.length,
      },
      exception: String(e),
    }, { status: 500 })
  }
}