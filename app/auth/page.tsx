import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import React from "react";
import { FaGithub } from "react-icons/fa";

export default function page() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="w-96 h-96 rounded-md border p-5 space-y-5 relative bg-slate-900">
        <div className="flex items-center gap-2">
          <KeyRound className="w-10 h-10" />
          <h1>AuthPage</h1>
        </div>
        <p className="text-sm text-gray-300">Register/SignIn Today 👇</p>
        <Button className="w-full flex items-center gap-2">
          <FaGithub className="w-4 h-4" />
          Github
        </Button>
        <Button className="w-full flex items-center gap-2">
          <FcGoogle className="w-4 h-4" />
          Google
        </Button>
      </div>
      <div className="glowbox -z-10"></div>
    </div>
  );
}
