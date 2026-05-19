import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.memoiofficial.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY1NTU4ODAwLCJleHAiOjE5MjMzMjUyMDB9.X6cisBKBavkuAyFyb_YkbpBGwD-cdN9S7UEm9iO5r_E';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('=== CHECKING PRODUCT VARIANTS ===\n');

// Get sample variants to see actual columns
const { data: variants, error } = await supabase
  .from('product_variants')
  .select('*')
  .limit(3);

console.log('Sample variants:');
if (error) console.error('Error:', error);
console.log(JSON.stringify(variants, null, 2));

// Try without color_name
console.log('\n=== PRODUCTS WITH VARIANTS (no color_name) ===\n');
const { data: products, error: prodError } = await supabase
  .from('products')
  .select(`
    id, name, sku, status,
    product_variants(id, size, stock, price)
  `)
  .eq('status', 'Active')
  .limit(3);

console.log('Products:', products?.length || 0);
if (prodError) console.error('Error:', prodError);
console.log(JSON.stringify(products, null, 2));
