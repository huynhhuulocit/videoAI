const encoder = new TextEncoder();

export const SITE_GATE_COOKIE_NAME = "videoai_site_gate";
export const SITE_GATE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type SiteGatePayload = {
  exp: number;
  iat: number;
  u: string;
};

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlEncodeText(value: string) {
  return base64UrlEncode(encoder.encode(value));
}

function base64UrlDecodeText(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function getSiteGateSecret() {
  return process.env.SITE_GATE_SECRET ?? "";
}

export function isSiteGateEnabled() {
  return process.env.SITE_GATE_ENABLED === "true";
}

export function getSiteGateUsername() {
  return process.env.SITE_GATE_USERNAME || "videoai";
}

function getSiteGatePassword() {
  return process.env.SITE_GATE_PASSWORD ?? "";
}

export function isSiteGateConfigured() {
  return Boolean(getSiteGateSecret() && getSiteGateUsername() && getSiteGatePassword());
}

export function getSafeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

async function getHmacKey() {
  const secret = getSiteGateSecret();
  if (!secret) {
    return null;
  }

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
}

async function signValue(value: string) {
  const key = await getHmacKey();
  if (!key) {
    return "";
  }

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function createSiteGateCookieValue(username: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SiteGatePayload = {
    exp: now + SITE_GATE_MAX_AGE_SECONDS,
    iat: now,
    u: username,
  };
  const encodedPayload = base64UrlEncodeText(JSON.stringify(payload));
  const signature = await signValue(encodedPayload);

  return signature ? `${encodedPayload}.${signature}` : "";
}

export async function verifySiteGateCookieValue(value: string | undefined) {
  if (!isSiteGateEnabled()) {
    return true;
  }
  if (!value || !isSiteGateConfigured()) {
    return false;
  }

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = await signValue(encodedPayload);
  if (!expectedSignature || !constantTimeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecodeText(encodedPayload)) as SiteGatePayload;
    const now = Math.floor(Date.now() / 1000);
    return payload.u === getSiteGateUsername() && payload.exp > now;
  } catch {
    return false;
  }
}

export async function verifySiteGateCredentials(username: string, password: string) {
  if (!isSiteGateEnabled()) {
    return true;
  }
  if (!isSiteGateConfigured()) {
    return false;
  }

  return (
    constantTimeEqual(username, getSiteGateUsername()) &&
    constantTimeEqual(password, getSiteGatePassword())
  );
}
