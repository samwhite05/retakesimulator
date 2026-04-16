import { headers } from "next/headers";

export async function getUserHash(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const userAgent = h.get("user-agent") || "";
  const base = forwarded || "anonymous";
  // Simple hash for anon identity
  const str = `${base}:${userAgent}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `u_${Math.abs(hash).toString(36)}`;
}
