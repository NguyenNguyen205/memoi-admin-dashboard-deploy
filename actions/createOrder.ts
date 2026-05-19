"use server";

import { supabase } from "@/lib/supabase";
import { generateRandomString } from "@/lib/utils";

// Type definitions
export interface LineItemInput {
  productVariantId: number;
  productName: string;
  productSku: string;
  size: string;
  colorName: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateOrderInput {
  email: string;
  phoneNumber: string;
  customerName?: string;
  shippingAddress: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  lineItems: LineItemInput[];
}

export interface CreateOrderResult {
  success: boolean;
  order?: {
    id: string;
    order_number: string;
  };
  error?: string;
}

/**
 * Generate a unique 10-character order number
 * Checks database for uniqueness and retries if collision occurs
 */
async function generateUniqueOrderNumber(): Promise<string> {
  const maxRetries = 5;

  for (let i = 0; i < maxRetries; i++) {
    const orderNumber = generateRandomString(10);

    // Check if order number already exists
    const { data, error } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", orderNumber)
      .single();

    // If no match found (error means not found), we have a unique number
    if (error && error.code === "PGRST116") {
      return orderNumber;
    }
  }

  throw new Error("Failed to generate unique order number after multiple attempts");
}

/**
 * Main server action to create an order
 * Handles: order insertion, line items, stock decrement
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  try {
    // Validate input
    if (!input.email || !input.phoneNumber) {
      return { success: false, error: "Email and phone number are required" };
    }

    if (!input.lineItems || input.lineItems.length === 0) {
      return { success: false, error: "At least one product is required" };
    }

    if (!input.shippingAddress.postalCode) {
      return { success: false, error: "Postal code is required for shipping" };
    }

    // Calculate order total
    const orderTotal = input.lineItems.reduce(
      (sum, item) => sum + (item.unitPrice * item.quantity),
      0
    );

    // Generate unique order number
    const orderNumber = await generateUniqueOrderNumber();

    // Step 1: Validate stock availability for all items
    for (const item of input.lineItems) {
      const { data: variant, error } = await supabase
        .from("product_variants")
        .select("stock")
        .eq("id", item.productVariantId)
        .single();

      if (error || !variant) {
        return {
          success: false,
          error: `Product variant ${item.productName} (${item.size}) not found`
        };
      }

      if (variant.stock < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock for ${item.productName} (${item.size}). Available: ${variant.stock}, Requested: ${item.quantity}`
        };
      }
    }

    // Step 2: Insert order
    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        email: input.email,
        phone_number: input.phoneNumber,
        shipping_address_line_1: input.shippingAddress.line1,
        shipping_city: input.shippingAddress.city,
        shipping_state: input.shippingAddress.state,
        shipping_zip_postal_code: input.shippingAddress.postalCode,
        shipping_country: input.shippingAddress.country,
        total: orderTotal,
        currency: "sgd",
        status: "IN_PROGRESS",
        user_id: null, // Stateless order
      })
      .select("id, order_number")
      .single();

    if (orderError || !newOrder) {
      console.error("Order creation error:", orderError);
      return {
        success: false,
        error: `Failed to create order: ${orderError?.message || "Unknown error"}`
      };
    }

    // Step 3: Insert order items
    const orderItems = input.lineItems.map(item => ({
      order_id: newOrder.id,
      product_variant_id: item.productVariantId,
      product_name: item.productName,
      product_sku: item.productSku,
      size: item.size,
      color_name: item.colorName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.unitPrice * item.quantity,
      currency: "sgd",
      active: true,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Order items creation error:", itemsError);
      // Attempt to delete the order since items failed
      await supabase.from("orders").delete().eq("id", newOrder.id);
      return {
        success: false,
        error: `Failed to create order items: ${itemsError.message}`
      };
    }

    // Step 4: Decrement stock for each item
    for (const item of input.lineItems) {
      const { error: stockError } = await supabase.rpc('decrement_stock', {
        variant_id: item.productVariantId,
        decrement_amount: item.quantity
      });

      // If RPC doesn't exist, fall back to direct update
      if (stockError && stockError.message?.includes('function')) {
        const { data: currentVariant } = await supabase
          .from("product_variants")
          .select("stock")
          .eq("id", item.productVariantId)
          .single();

        if (currentVariant) {
          const { error: updateError } = await supabase
            .from("product_variants")
            .update({ stock: currentVariant.stock - item.quantity })
            .eq("id", item.productVariantId)
            .gte("stock", item.quantity); // Prevents negative stock

          if (updateError) {
            console.error("Stock decrement error:", updateError);
            // Don't fail the entire order, but log the issue
          }
        }
      }
    }

    return {
      success: true,
      order: {
        id: newOrder.id,
        order_number: newOrder.order_number,
      },
    };

  } catch (error: any) {
    console.error("Create order error:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred while creating the order",
    };
  }
}
