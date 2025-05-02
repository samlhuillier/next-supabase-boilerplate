import { Button } from "@/components/ui/button";
import Link from "next/link";

export function Profile() {
  return (
    <div>
      <Link href="/auth">
        <Button variant="outline">Sign in</Button>
      </Link>
    </div>
  );
}
