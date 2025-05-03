"use client";

import { useUser } from "@/app/auth/hooks/useUser";
import { checkout } from "@/lib/actions/stripe";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import React from "react";

type CheckoutProps = {
  priceId: string;
};

export default function Checkout({ priceId }: CheckoutProps) {
  const { data: user } = useUser();
  const router = useRouter();
  const handleCheckout = async () => {
    if (!user?.id) {
      router.push("/auth?next=" + window.location.pathname);
      return;
    }

    const session = JSON.parse(
      await checkout(user.email, priceId, location.origin + "/success-bro")
    );
    const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK!);
    const res = await stripe?.redirectToCheckout({ sessionId: session.id });
    if (res?.error) {
      alert(res.error.message);
    }

    // if (session.url) {
    //   window.location.href = session.url;
    // }
  };
  return (
    <div onClick={handleCheckout} className="cursor-pointer">
      Getting started...
    </div>
  );
}
