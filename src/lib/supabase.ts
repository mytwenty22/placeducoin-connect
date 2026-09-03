import { createClient } from "@supabase/supabase-js";

// Fallback values for this project's public Supabase URL and anon/publishable key. These are not
// secrets — the anon key is protected only by Row Level Security and is already shipped inside
// every client bundle regardless — so hardcoding them here just prevents a hosting environment
// that forgot to set VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY from crashing the whole app.
// Configuring them properly on the hosting platform (Vercel → Settings → Environment Variables)
// is still the correct fix; this is only a safety net.
const FALLBACK_SUPABASE_URL = "https://qerntkgpddlfiarmsyya.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable__K7WoxDdqz1JTxmLyoME6A_oNgQKLV8";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] || FALLBACK_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
