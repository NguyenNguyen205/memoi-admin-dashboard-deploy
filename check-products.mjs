import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.memoiofficial.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY1NTU4ODAwLCJleHAiOjE5MjMzMjUyMDB9.X6cisBKBavkuAyFyb_YkbpBGwD-cdN9S7UEm9iO5r_E';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('=== CHECKING PRODUCTS ===\n');

// Check active products
const { data: activeProducts, error: activeError } = await supabase
  .from('products')
  .select('id, name, sku, status')
  .eq('status', 'Active');

console.log('Active Products:', activeProducts?.length || 0);
if (activeError) console.error('Error:', activeError);
console.log(JSON.stringify(activeProducts, null, 2));

// Check products with variants
console.log('\n=== PRODUCTS WITH VARIANTS ===\n');
const { data: productsWithVariants, error: variantsError } = await supabase
  .from('products')
  .select(`
    id, name, sku, status,
    product_variants(id, size, stock, price, color_name)
  `)
  .eq('status', 'Active');

console.log('Products with variants:', productsWithVariants?.length || 0);
if (variantsError) console.error('Error:', variantsError);
console.log(JSON.stringify(productsWithVariants, null, 2));
