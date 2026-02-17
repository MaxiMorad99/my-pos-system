import { createClient } from '@supabase/supabase-js';

// Reemplaza esto con los datos de Project Settings > API
const supabaseUrl = 'https://cokheqajskbcckhmpjzu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva2hlcWFqc2tiY2NraG1wanp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNjQ4MjYsImV4cCI6MjA4NTY0MDgyNn0.1e-FYR8SXK7kpvYFVjP4UirkEMKXEFK7kZtuGWSufMI';

export const supabase = createClient(supabaseUrl, supabaseKey);