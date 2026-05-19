import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.memoiofficial.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY1NTU4ODAwLCJleHAiOjE5MjMzMjUyMDB9.X6cisBKBavkuAyFyb_YkbpBGwD-cdN9S7UEm9iO5r_E';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('=== EXPLORING SUPABASE DATABASE ===\n');

// 1. Get sample orders
console.log('--- SAMPLE ORDERS (order_number format analysis) ---');
const { data: orders, error: ordersError } = await supabase
  .from('orders')
  .select('id, order_number, email, total, currency, status, created_at, user_id, phone_number, shipping_address_line_1, shipping_zip_postal_code')
  .order('created_at', { ascending: false })
  .limit(10);

if (ordersError) {
  console.error('Error:', ordersError);
} else {
  console.log(JSON.stringify(orders, null, 2));
}

// 2. Order items
console.log('\n--- SAMPLE ORDER ITEMS ---');
const { data: orderItems, error: itemsError } = await supabase
  .from('order_items')
  .select('*')
  .limit(5);

if (!itemsError) {
  console.log(JSON.stringify(orderItems, null, 2));
}

// 3. Products with variants
console.log('\n--- PRODUCTS WITH VARIANTS (Active only) ---');
const { data: products, error: productsError } = await supabase
  .from('products')
  .select('id, name, sku, status, product_variants(id, size, stock, price)')
  .eq('status', 'Active')
  .limit(3);

if (!productsError) {
  console.log(JSON.stringify(products, null, 2));
}

console.log('\n=== DONE ===');
