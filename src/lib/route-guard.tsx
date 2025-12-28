'use client';
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const ok = !!session && Number.isInteger(session.userId as any);
    if (!ok) router.replace("/auth");
  }, [session, router]);

  const ok = !!session && Number.isInteger(session.userId as any);
  if (!ok) return null;
  return <>{children}</>;
}
