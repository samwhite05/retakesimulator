/**
 * Encode / decode JSON in a URL query param without `btoa` Latin-1 errors (UTF-8 safe).
 */

export function encodeUtf8JsonForQueryParam(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return encodeURIComponent(btoa(binary));
}

export function decodeUtf8JsonFromQueryParam<T = unknown>(encoded: string): T {
  const binary = atob(decodeURIComponent(encoded));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)!;
  const json = new TextDecoder().decode(out);
  return JSON.parse(json) as T;
}
