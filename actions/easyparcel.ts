//@ts-nocheck
"use server";

import { supabase } from "@/lib/supabase";
import { format, addDays } from "date-fns";

const EP_BASE = process.env.EP_BASE_URL ?? "https://connect.easyparcel.sg/?ac=";
const API_KEY = process.env.EP_API_KEY ?? "";

// --- UTILS ---
function encodeForm(data: Record<string, unknown>): URLSearchParams {
    const params = new URLSearchParams();
    const append = (key: string, value: unknown) => {
        if (value === undefined || value === null) return;
        params.append(key, String(value));
    };

    for (const key in data) {
        const value = data[key];
        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                for (const subKey in item) {
                    append(`${key}[${index}][${subKey}]`, item[subKey]);
                }
            });
        } else {
            append(key, value);
        }
    }
    return params;
}

async function callEP<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
    const form = encodeForm({ api: API_KEY, ...body });
    const res = await fetch(EP_BASE + action, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
    });

    const raw = await res.text();
    console.log(raw);

    if (!res.ok) throw new Error(`EasyParcel HTTP ${res.status}: ${res.statusText}`);

    let json: any;
    try {
        json = JSON.parse(raw);
    } catch {
        throw new Error(`[${action}] Invalid JSON from EasyParcel. Raw response: "${raw}"`);
    }

    if (json?.status && String(json.status) !== "200") {
        throw new Error(`EasyParcel [${action}] Error: ${json.message ?? raw}`);
    }
    return json as T;
}

function removeVietnameseTones(str) {
    return str
        .normalize('NFD') // separate accent from letter
        .replace(/[\u0300-\u036f]/g, '') // remove all accents
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

// --- MAIN ACTION: DYNAMIC ADDRESSES ---
export async function processBulkFulfillment(orderIds: string[], defaultWeight: number = 1) {
    try {
        const creditData = await callEP<any>("EPCheckCreditBalance");
        const creditStr = typeof creditData.result === 'number'
            ? creditData.result
            : (creditData.credit ?? creditData.result?.credit ?? "0");

        if (parseFloat(String(creditStr)) < 0) {
            return { success: false, error: "Insufficient EasyParcel credit." };
        }

        const { data: rawOrders, error: dbError } = await supabase
            .from("orders")
            .select(`
        id, order_number, total, shipping_address_line_1, shipping_city, shipping_state, shipping_zip_postal_code, shipping_country, phone_number,
        billing_info (first_name, last_name, phone_number, address, city, state, zip_code, country),
        users (first_name, last_name, phone_number, address, city, state, zip_code, country),
        order_items (product_name, quantity)
      `)
            .in("id", orderIds);

        if (dbError || !rawOrders) throw new Error("Failed to fetch orders from database.");

        let updatedCount = 0;

        for (const order of rawOrders) {

            const SENDER = {
                name: "Nan",
                contact: "87184113",
                postcode: "427525",
                country: "SG",
                state: "SG",
                addr1: "271B Joo Chiat Road", // Back where it belongs!
                unit: "",
            };

            // 📍 DYNAMIC RECEIVER WATERFALL (From DB)
            const billing = order.billing_info?.[0];
            const user = order.users;

            const receiverName = order.shipping_address_line_1 ? "Customer" : billing?.first_name ? `${billing.first_name} ${billing.last_name}` : user?.first_name ? `${user.first_name} ${user.last_name}` : "Customer";
            const receiverPhone = order.phone_number || billing?.phone_number || user?.phone_number || "00000000";
            const receiverZip = order.shipping_zip_postal_code || billing?.zip_code || user?.zip_code || "";
            const receiverCountry = order.shipping_country || billing?.country || user?.country || "SG";
            const receiverState = order.shipping_state || billing?.state || user?.state || "SG";

            const receiverAddr = order.shipping_address_line_1 || billing?.address || user?.address || "No address provided";

            if (!receiverZip) throw new Error(`Order ${order.order_number} has no zip code.`);

            const collectionDate = format(addDays(new Date(), 1), "yyyy-MM-dd");
            const contentDesc = order.order_items?.map((item: any) => `${item.quantity}x ${item.product_name}`).join(", ") || "Apparel";

            const pkgLength = 26;
            const pkgWidth = 37;
            const pkgHeight = 10;
            // Step 2: Rate Check
            const rateData = await callEP<any>("EPRateCheckingBulk", {
                bulk: [{
                    pick_code: SENDER.postcode,
                    pick_state: SENDER.state,
                    pick_country: SENDER.country,
                    send_code: receiverZip,
                    send_state: receiverState,
                    send_country: receiverCountry,
                    weight: defaultWeight,
                    width: pkgWidth,
                    length: pkgLength,
                    height: pkgHeight,
                    date_coll: collectionDate
                }]
            });

            const rateResult = rateData?.result?.[0];
            if (rateResult?.status === "Fail" || !rateResult?.rates) {
                throw new Error(`Rate error: ${rateResult?.remarks || "No rates available for this destination."}`);
            }

            const pickupServices = rateResult.rates.filter((r: any) => r.service_detail === "pickup");
            if (pickupServices.length === 0) throw new Error("No pickup services available for this destination.");

            const cheapest = pickupServices.reduce((a: any, b: any) =>
                parseFloat(a.price) <= parseFloat(b.price) ? a : b
            );

            // Step 3: Submit Order
            const submitData = await callEP<any>("EPSubmitOrderBulk", {
                bulk: [{
                    service_id: cheapest.service_id,
                    weight: defaultWeight,
                    width: pkgWidth,
                    length: pkgLength,
                    height: pkgHeight,
                    content: contentDesc.substring(0, 30),
                    value: order.total,

                    // SENDER
                    pick_name: SENDER.name,
                    pick_contact: SENDER.contact,
                    pick_mobile: "",
                    pick_company: "",
                    pick_addr1: SENDER.addr1,      // 🚨 REQUIRED
                    pick_unit: SENDER.unit,
                    pick_code: SENDER.postcode,
                    pick_country: SENDER.country,
                    pick_state: SENDER.state,

                    // RECEIVER
                    send_name: removeVietnameseTones(receiverName),
                    send_contact: receiverPhone.replace(/\D/g, ""),
                    send_mobile: "",
                    send_company: "",
                    send_addr1: receiverAddr.substring(0, 50),
                    send_unit: "",
                    send_code: receiverZip,
                    send_country: receiverCountry,
                    send_state: receiverState,

                    collect_date: collectionDate
                }]
            });

            const orderResult = submitData?.result?.[0];
            if (!orderResult || orderResult.status !== "Success") {
                throw new Error(`Submit error: ${orderResult?.remarks}`);
            }

            const orderNum = orderResult.order_number;

            // Step 4: Pay Order
            const payData = await callEP<any>("EPPayOrderBulk", {
                bulk: [{ order_no: orderNum }]
            });

            const payResult = payData?.result?.[0];
            const isPaid = payResult?.messagenow === "Payment Done" || payResult?.messagenow === "Fully paid";

            if (payData?.api_status !== "Success" && !isPaid) {
                throw new Error(`Pay error for order ${orderNum}. EasyParcel said: ${payResult?.messagenow || "Unknown error"}`);
            }

            const trackingNumber = payResult?.parcel?.[0]?.awb || payResult?.parcel?.[0]?.parcelno || "Pending";
            const labelUrl = payResult?.parcel?.[0]?.awb_id_link || "";
            const trackingUrl = payResult?.parcel?.[0]?.tracking_url || "";

            // Step 5: Update DB
            await supabase
                .from("orders")
                .update({
                    status: "COMPLETED",
                    awb: trackingNumber,
                    awb_tracking_url: trackingUrl,
                    awb_label_url: labelUrl,
                })
                .eq("id", order.id);

            updatedCount++;
        }

        return { success: true, count: updatedCount, message: `Successfully fulfilled ${updatedCount} orders.` };

    } catch (error: any) {
        return { success: false, error: error.message || "An unexpected error occurred." };
    }
}

// --- UI PREVIEW ACTION ---
export async function getFulfillmentPreview(orderIds: string[], defaultWeight: number) {
    try {
        const creditData = await callEP<any>("EPCheckCreditBalance");
        const creditStr = typeof creditData.result === 'number'
            ? creditData.result
            : (creditData.credit ?? creditData.result?.credit ?? "0");
        const credit = parseFloat(String(creditStr));

        const { data: rawOrders } = await supabase
            .from("orders")
            .select(`shipping_zip_postal_code, billing_info(zip_code, country, state), users(zip_code, country, state)`)
            .in("id", orderIds);

        let totalCost = 0;
        let rateError = "";

        // Calculate rates dynamically based on the DB addresses
        if (rawOrders) {
            for (const order of rawOrders) {
                const billing = order.billing_info?.[0];
                const user = order.users;
                const receiverZip = order.shipping_zip_postal_code || billing?.zip_code || user?.zip_code || "";

                if (!receiverZip) continue;

                const rateData = await callEP<any>("EPRateCheckingBulk", {
                    bulk: [{
                        pick_code: "427525", // New Origin
                        pick_state: "SG",
                        pick_country: "SG",
                        send_code: receiverZip,
                        send_state: order.shipping_state || billing?.state || user?.state || "SG",
                        send_country: order.shipping_country || billing?.country || user?.country || "SG",
                        weight: defaultWeight,
                    }]
                });

                const rateResult = rateData?.result?.[0];
                if (rateResult?.status === "Fail") {
                    rateError = rateResult.remarks || "No rates available.";
                } else if (rateResult?.status === "Success" && rateResult.rates) {
                    const pickupServices = rateResult.rates.filter((r: any) => r.service_detail === "pickup");
                    if (pickupServices.length > 0) {
                        const cheapest = pickupServices.reduce((a: any, b: any) => parseFloat(a.price) <= parseFloat(b.price) ? a : b);
                        totalCost += parseFloat(cheapest.price);
                    }
                }
            }
        }

        if (rateError) return { success: false, error: rateError, credit };
        return { success: true, credit, totalCost };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}