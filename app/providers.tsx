"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

/**
 * Client-side Session Provider wrapper
 * 
 * Wraps the app to provide NextAuth session context
 * Must be a Client Component to use SessionProvider
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
