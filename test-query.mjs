import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.memoiofficial.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY1NTU4ODAwLCJleHAiOjE5MjMzMjUyMDB9.X6cisBKBavkuAyFyb_YkbpBGwD-cdN9S7UEm9iO5r_E';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Testing the exact query from CreateOrderModal...\n');

const { data, error } = await supabase
  .from("products")
  .select(`
    id, name, sku,
    product_variants(id, size, stock, price)
  `)
  .eq("status", "Active")
  .order("name");

if (error) {
  console.error('ERROR:', error);
} else {
  console.log('SUCCESS! Found', data.length, 'products');
  console.log('\nFirst 3 products:');
  data.slice(0, 3).forEach(p => {
    console.log(`\n${p.name}`);
    console.log(`  SKU: ${p.sku}`);
    console.log(`  Variants: ${p.product_variants?.length || 0}`);
    if (p.product_variants) {
      p.product_variants.forEach(v => {
        console.log(`    - ${v.size}: $${v.price} (${v.stock} in stock)`);
      });
    }
  });
}
