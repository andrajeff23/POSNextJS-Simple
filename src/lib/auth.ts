import { cookies } from "next/headers"
import { db } from "./db"

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
}

const SESSION_COOKIE = "pos-session"
const SECRET = process.env.AUTH_SECRET || "pos-kasir-secret-key-2024"

// Simple signed token: base64(payload).hmac(payload)
async function sign(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload))
  const sigHex = Buffer.from(new Uint8Array(sig)).toString("hex")
  return `${Buffer.from(payload).toString("base64")}.${sigHex}`
}

async function verify(token: string): Promise<string | null> {
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [payloadB64] = parts
  try {
    const payload = Buffer.from(payloadB64, "base64").toString()
    const expected = await sign(payload)
    if (expected !== token) return null
    return payload
  } catch {
    return null
  }
}

export async function createSession(user: SessionUser): Promise<string> {
  const payload = JSON.stringify({ id: user.id, email: user.email, name: user.name, role: user.role, ts: Date.now() })
  return sign(payload)
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const payload = await verify(token)
  if (!payload) return null
  try {
    const data = JSON.parse(payload)
    // Validate user still exists
    const user = await db.user.findUnique({ where: { id: data.id } })
    if (!user) return null
    return { id: user.id, email: user.email, name: user.name, role: user.role }
  } catch {
    return null
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
