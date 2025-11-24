import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use Service Role for admin tasks (writing articles, uploading images)

if (!supabaseUrl || !supabaseKey) {
  console.warn("Missing Supabase environment variables. Database features may not work.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);


