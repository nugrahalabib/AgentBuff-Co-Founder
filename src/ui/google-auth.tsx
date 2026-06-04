"use client";

import { signIn, signOut } from "next-auth/react";
import { Button } from "@/ui/button";

type Variant = "primary" | "accent" | "secondary" | "ghost";

export function GoogleSignInButton({
  callbackUrl = "/onboarding",
  label = "Login dengan Google",
  variant = "secondary",
  size = "lg",
}: {
  callbackUrl?: string;
  label?: string;
  variant?: Variant;
  size?: "md" | "lg";
}) {
  return (
    <Button
      onClick={() => {
        void signIn("google", { callbackUrl });
      }}
      variant={variant}
      size={size}
      className="w-full"
    >
      <GoogleMark className="h-5 w-5" />
      {label}
    </Button>
  );
}

export function SignOutButton() {
  return (
    <button
      onClick={() => {
        // Wipe any cached pages/assets so no data lingers on a shared device after sign-out.
        navigator.serviceWorker?.controller?.postMessage({ type: "clear-cache" });
        void signOut({ callbackUrl: "/" });
      }}
      className="cursor-pointer rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
    >
      Keluar
    </button>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#FFC107" d="M21.35 11.1H12v3.83h5.34A5.34 5.34 0 0 1 6.66 12 5.34 5.34 0 0 1 12 6.66c1.36 0 2.6.51 3.54 1.36l2.7-2.7A9 9 0 1 0 21 12c0-.61-.06-1.2-.16-1.76z" />
      <path fill="#FF3D00" d="M3.15 7.35l3.15 2.31A5.34 5.34 0 0 1 12 6.66c1.36 0 2.6.51 3.54 1.36l2.7-2.7A9 9 0 0 0 3.15 7.35z" />
      <path fill="#4CAF50" d="M12 21a9 9 0 0 0 6.07-2.35l-2.8-2.37A5.34 5.34 0 0 1 6.7 14.3l-3.13 2.4A9 9 0 0 0 12 21z" />
      <path fill="#1976D2" d="M21.35 11.1H12v3.83h5.34a5.36 5.36 0 0 1-1.87 2.35l2.8 2.37C20.4 18 21 15.4 21 12c0-.31-.02-.6-.05-.9z" />
    </svg>
  );
}
