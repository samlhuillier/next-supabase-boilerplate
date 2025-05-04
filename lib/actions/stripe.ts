"use server";

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function checkout(email: string, priceId: string, redirectTo: string) {

    const session = await stripe.checkout.sessions.create({
        success_url: redirectTo || process.env.SITE_URL,
        cancel_url: process.env.SITE_URL,
        customer_email: email,
        line_items: [{
            price: priceId,
            quantity: 1,
        }],
        mode: "subscription",
    });

    // so I guess the reason we need to stringify this is to pass it to the client given that this is a server action
    return JSON.stringify(session);
}


export async function cancelSubscription(customerId: string) {
    console.log("Cancelling subscription for customerId: ", customerId);
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: process.env.SITE_URL,
    });

    console.log("Session: ", session);
    return session.url;
}