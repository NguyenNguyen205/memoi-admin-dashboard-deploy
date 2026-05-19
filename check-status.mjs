import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.memoiofficial.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY1NTU4ODAwLCJleHAiOjE5MjMzMjUyMDB9.X6cisBKBavkuAyFyb_YkbpBGwD-cdN9S7UEm9iO5r_E';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Checking actual order status values in database...\n');

const { data: orders, error } = await supabase
  .from('orders')
  .select('status')
  .limit(20);

if (error) {
  console.error('Error:', error);
} else {
  const uniqueStatuses = [...new Set(orders.map(o => o.status))];
  console.log('Unique status values found:');
  uniqueStatuses.forEach(status => console.log(`  - "${status}"`));
}
