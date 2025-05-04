"use client";

import { useUser } from "@/app/auth/hooks/useUser";
import { Button } from "@/components/ui/button";
import { cancelSubscription } from "@/lib/actions/stripe";
import React from "react";

export default function Subscription() {
  const { data: user, isLoading } = useUser();

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>Not logged in</div>;

  return (
    <div className="space-y-5">
      <h1>Subscription</h1>
      {/* <p>{user.subscription.end_at}</p> */}
      <h1 className="text-2xl font-bold">{user.display_name}</h1>
      <p className="text-sm text-gray-500">
        Your subscription will end at {user.subscription?.end_at}
      </p>
      {user.subscription && user.subscription.customer_id && (
        <Button
          onClick={async () => {
            const portalUrl = await cancelSubscription(
              user.subscription!.customer_id!
            );
            window.open(portalUrl, "_blank");
          }}
        >
          Cancel Subscription
        </Button>
      )}
    </div>
  );
}
