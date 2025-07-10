"use client";
import { useUser } from "@/app/auth/hooks/useUser";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
export function Profile() {
  const { isFetching, data: user } = useUser();
  const queryClient = useQueryClient();
  const router = useRouter();

  if (isFetching) {
    return <div>Loading...</div>;
  }

  const handleLogout = () => {
    const supabase = supabaseBrowser();
    queryClient.clear();

    supabase.auth.signOut();
    router.refresh();
  };

  return (
    <div>
      {user?.id ? (
        <>
          {user?.image_url ? (
            <Image
              src={user.image_url ?? ""}
              alt={user.display_name ?? ""}
              width={50}
              height={50}
              className="rounded-full cursor-pointer"
              onClick={handleLogout}
            />
          ) : (
            <div
              className="rounded-full bg-gray-200 w-10 h-10 cursor-pointer"
              onClick={handleLogout}
            >
              {user.email}
            </div>
          )}
        </>
      ) : (
        <Link href="/auth">
          <Button variant="outline">Sign in</Button>
        </Link>
      )}
    </div>
  );
}
