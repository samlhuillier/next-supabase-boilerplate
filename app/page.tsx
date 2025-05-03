import { Button } from "@/components/ui/button";
import Link from "next/link";
import Price from "@/components/subscription/price";
export default function Home() {
  return (
    <div className="grid items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] w-full">
      <div className="flex justify-center">
        <Link href="/dashboard">Go to Dashboard</Link>
      </div>
      <div className="flex justify-center">
        <Link href="/profile">Go to Profile</Link>
      </div>
      <div className="w-full">
        <Price />
      </div>
    </div>
  );
}
