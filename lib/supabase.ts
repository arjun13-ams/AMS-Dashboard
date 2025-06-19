import { createClient } from '@supabase/supabase-js';

export const supabase = createClient('https://your-project.supabase.co', 'your-anon-key');