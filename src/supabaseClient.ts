import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bzfdisecqlkfqujvkyvi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZmRpc2VjcWxrZnF1anZreXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNDAzMjQsImV4cCI6MjA5NzYxNjMyNH0.GqZhWs1dU9f30pdipFZ1ae0Q1uF6F5Jq-TBhC1BbzLM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
