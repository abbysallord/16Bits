// Server-owner fallback when a team's only admin forgets their password:
//   cd backend && DATABASE_URL=... npm run reset-code -- someone@example.com
// Prints a one-time code; the person uses FORGOT PASSWORD on the sign-in dialog.
import 'dotenv/config'
import { db, initDatabase } from '../db/database.js'
import { issueResetCode, isDemoEmail } from '../services/passwordResetService.js'

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: npm run reset-code -- <email>')
    process.exit(1)
  }
  if (isDemoEmail(email)) {
    console.error('The public demo account cannot be reset.')
    process.exit(1)
  }
  await initDatabase()
  const user = await db.get<{ id: string; name: string }>('SELECT id, name FROM users WHERE email = ?', [email])
  if (!user) {
    console.error(`No account with email ${email}`)
    process.exit(1)
  }
  const { code, expiresAt } = await issueResetCode(user.id, 'server-owner')
  console.log(`Reset code for ${user.name} <${email}>: ${code}`)
  console.log(`Expires ${expiresAt}. They enter it under SIGN IN -> FORGOT PASSWORD?`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
