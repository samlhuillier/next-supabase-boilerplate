"use client";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import React, { Suspense } from "react";
import { FaGithub } from "react-icons/fa";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useSearchParams } from "next/navigation";

function AuthForm() {
  const params = useSearchParams();
  const next = params.get("next");
  const handleLoginWithOAuth = async (provider: "github" | "google") => {
    const supabase = supabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: location.origin + "/auth/callback?next=" + next,
      },
    });
  };
  return (
    <div className="w-96 h-96 rounded-md border p-5 space-y-5 relative bg-slate-900">
      <div className="flex items-center gap-2">
        <KeyRound className="w-10 h-10" />
        <h1>AuthPage</h1>
      </div>
      <p className="text-sm text-gray-300">Register/SignIn Today 👇</p>
      <Button
        className="w-full flex items-center gap-2"
        onClick={() => handleLoginWithOAuth("github")}
      >
        <FaGithub className="w-4 h-4" />
        Github
      </Button>
      <Button
        className="w-full flex items-center gap-2"
        onClick={() => handleLoginWithOAuth("google")}
      >
        <FcGoogle className="w-4 h-4" />
        Google
      </Button>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <Suspense>
        <AuthForm />
      </Suspense>
      <div className="glowbox -z-10"></div>
    </div>
  );
}
