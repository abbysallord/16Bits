// Public judge/demo login. DEMO_ACCOUNT=off turns it off for a real deployment:
// nothing is seeded and sign-in with the demo email is refused, even if the row already exists.
export const DEMO_EMAIL = 'admin@16bits.io'

export function demoAccountEnabled(): boolean {
  return !['off', 'false', '0', 'no'].includes((process.env.DEMO_ACCOUNT || 'on').toLowerCase())
}
