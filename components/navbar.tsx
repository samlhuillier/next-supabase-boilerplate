import Link from "next/link";
import { Profile } from "./profile";

export function Navbar() {
  return (
    <div className="flex justify-between items-center">
      <Link href="/">
        <h1 className="text-2xl font-bold">Logo</h1>
      </Link>
      <Profile />
    </div>
  );
}
