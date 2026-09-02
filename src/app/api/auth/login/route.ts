import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (!user) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 })
    }

    const token = await createSession({ id: user.id, email: user.email, name: user.name, role: user.role })

    const res = NextResponse.json({
      id: user.id, email: user.email, name: user.name, role: user.role,
    })
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    })
    return res
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Gagal masuk" }, { status: 500 })
  }
}
