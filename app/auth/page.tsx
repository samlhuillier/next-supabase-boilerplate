"use client";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";
// import { FcGoogle } from "react-icons/fc";
import React, { Suspense, useState } from "react";
// import { FaGithub } from "react-icons/fa";
import { supabaseBrowser } from "@/lib/supabase/browser";
// import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

function AuthForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // const handleLoginWithOAuth = async (provider: "github" | "google") => {
  //   const supabase = supabaseBrowser();
  //   await supabase.auth.signInWithOAuth({
  //     provider,
  //     options: {
  //       redirectTo: location.origin + "/auth/callback?next=" + next,
  //     },
  //   });
  // };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const supabase = supabaseBrowser();

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: "http://localhost:3000/auth/callback",
          },
        });
        if (error) throw error;
        // Show success message for sign up
        setError("Please check your email to confirm your account");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Redirect to home page after successful sign in
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <div className="w-96 rounded-md border p-5 space-y-5 relative bg-slate-900">
      <div className="flex items-center gap-2">
        <KeyRound className="w-10 h-10" />
        <h1>AuthPage</h1>
      </div>
      <p className="text-sm text-gray-300">Register/SignIn Today 👇</p>

      <form onSubmit={handleEmailAuth} className="space-y-4">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Button type="submit" className="w-full">
          {isSignUp ? "Sign Up" : "Sign In"}
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full"
        >
          {isSignUp
            ? "Already have an account? Sign In"
            : "Don't have an account? Sign Up"}
        </Button>
      </form>

      {/* OAuth section commented out
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-slate-900 px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

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
      */}
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
