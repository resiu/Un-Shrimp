// Login tokens (JWT) and password hashing.
//
// How login works:
//   1. /api/login checks the password, then gives the browser a signed token.
//   2. The browser sends it back on every request:  Authorization: Bearer <token>
//   3. requireAuth (below) checks the signature, so we know who's asking without
//      looking anything up. The WebSocket uses the same token in its URL.

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

export type AuthUser = { id: number; username: string }
/** A request that has passed requireAuth. */
export type AuthedRequest = Request & { user: AuthUser }

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('\n  Missing JWT_SECRET. Copy backend/.env.example to backend/.env and try again.\n')
  process.exit(1)
}
const secret: string = JWT_SECRET

export function createToken(user: AuthUser): string {
  return jwt.sign({ id: user.id, username: user.username }, secret, { expiresIn: '7d' })
}

/** Returns the user inside a valid token, or null if it's missing/fake/expired. */
export function verifyToken(token: string | null | undefined): AuthUser | null {
  if (!token) return null
  try {
    const payload = jwt.verify(token, secret) as AuthUser
    return { id: payload.id, username: payload.username }
  } catch {
    return null
  }
}

/** Express middleware: lets the request through only with a valid Bearer token. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? ''
  const user = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : null)
  if (!user) {
    res.status(401).json({ error: 'Please log in' })
    return
  }
  ;(req as AuthedRequest).user = user
  next()
}

// ---- Passwords: scrypt (built into Node) with a random salt per user ----
// Stored as "salt:hash" in hex. We never store the password itself.

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>
const KEY_LEN = 64

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, KEY_LEN)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length)
  // timingSafeEqual takes the same time whether the first or last byte differs,
  // so attackers can't guess the hash byte by byte from response times.
  return timingSafeEqual(actual, expected)
}
