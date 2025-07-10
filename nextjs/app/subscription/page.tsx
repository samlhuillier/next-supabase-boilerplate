"use client";

import Price from "@/components/subscription/price";
import { useUser } from "../auth/hooks/useUser";
import Post from "./components/post";

export default function SubscriptionPage() {
  const { data: user, isLoading } = useUser();

  if (isLoading) return <div>Loading...</div>;
  //   if (!user) return <div>Not logged in</div>;

  const isActive = user?.subscription?.end_at
    ? new Date(user.subscription.end_at) > new Date()
    : true;
  return (
    <div>
      <h1>Subscription</h1>
      {isActive ? (
        <Post />
      ) : (
        <div>
          <Price />
        </div>
      )}
    </div>
  );
}
