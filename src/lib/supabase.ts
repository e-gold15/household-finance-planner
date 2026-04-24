import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL  as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && key)

// When unconfigured we still export a client object so imports don't break,
// but every call will fail — the UI checks supabaseConfigured and shows a
// setup screen before any auth attempt is made.
export const supabase = supabaseConfigured
  ? createClient(url!, key!)
  : createClient('https://placeholder.supabase.co', 'placeholder-key')
