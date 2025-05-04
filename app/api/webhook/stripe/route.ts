import Stripe from "stripe";
import { headers } from "next/headers";
import { buffer } from "node:stream/consumers";
import { supabaseAdmin } from "@/lib/supabase/admin";

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function POST(req: any) {
	const rawBody = await buffer(req.body);
	try {
		const sig = (await headers()).get("stripe-signature");
		let event;
		try {
			event = stripe.webhooks.constructEvent(
				rawBody,
				sig!,
				endpointSecret
			);
		} catch (err: unknown) {
			const message = (err && typeof err === "object" && "message" in err)
				? (err as { message: string }).message
				: "Unknown error";
			return Response.json({ error: `Webhook Error ${message}` });
		}
		switch (event.type) {
			case "invoice.payment_succeeded":
				// update here
				const result = event.data.object;
				const end_at = new Date(
					result.lines.data[0].period.end * 1000
				).toISOString();
				const customer_id = result.customer as string;
				const subscription_id = result.lines.data[0].subscription as string;
				const email = result.customer_email as string;
				const error = await onPpaymentSucceeded(
					end_at,
					customer_id,
					subscription_id,
					email
				);
				if (error) {
					console.log(error);
					return Response.json({ error: error.message });
				}
				break;
			case "customer.subscription.deleted":
				const deleteSubscription = event.data.object;
				const cancelError = await onSubCancel(deleteSubscription.id);
				if (cancelError) {
					console.log(cancelError);
					return Response.json({ error: cancelError.message });
				}
				break;
			default:
				// console.log(`Unhandled event type ${event.type}`);
		}
		return Response.json({});
	} catch {
		return Response.json({ error: `Webhook Error}` });
	}
}

async function onPpaymentSucceeded(
	end_at: string,
	customer_id: string,
	subscription_id: string,
	email: string
) {
    console.log("onPpaymentSucceeded", end_at, customer_id, subscription_id, email);
	const supabase = await supabaseAdmin();

    // 1. Check if a record with that email exists
    const { data: existingRecords, error: selectError } = await supabase
        .from("subscription")
        .select("*")
        .eq("email", email);

    if (selectError) {
        console.error("Error selecting subscription by email:", selectError);
    } else if (!existingRecords || existingRecords.length === 0) {
        console.warn(`No subscription record found for email: ${email}`);
    } else {
        console.log("Found subscription record(s):", existingRecords);
    }

    // 2. Log the table columns and types
    const { data: columns, error: schemaError } = await supabase
        .rpc('pg_table_def', { tablename: 'subscription' }); // This works if you have a helper function in your DB, otherwise see below

    if (schemaError) {
        console.error("Error fetching table schema:", schemaError);
    } else {
        console.log("Subscription table columns and types:", columns);
    }

    // 3. Attempt the update
	const { error } = await supabase
		.from("subscription")
		.update({
			end_at,
			customer_id,
			subscription_id,
		})
		.eq("email", email);

    if (error) {
        console.error("Error updating subscription:", error);
    } else {
        console.log("Subscription updated successfully for email:", email);
    }

	return error;
}

async function onSubCancel(subscription_id: string) {
	const supabase = await supabaseAdmin();
	const { error } = await supabase
		.from("subscription")
		.update({
			customer_id: null,
			subscription_id: null,
		})
		.eq("subscription_id", subscription_id);
	return error;
}