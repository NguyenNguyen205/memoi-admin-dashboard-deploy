import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.memoiofficial.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY1NTU4ODAwLCJleHAiOjE5MjMzMjUyMDB9.X6cisBKBavkuAyFyb_YkbpBGwD-cdN9S7UEm9iO5r_E';

const supabase = createClient(supabaseUrl, supabaseKey);

// Check order_items structure
const { data: items, error } = await supabase
  .from('order_items')
  .select('*')
  .limit(1);

console.log('Order Items columns:');
if (error) console.error('Error:', error);
console.log(JSON.stringify(items, null, 2));
