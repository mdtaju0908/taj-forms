import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { User } from '../src/models.js'

const run = async () => {
  const uri = process.env.MONGODB_URI
  const email = String(process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase()
  const password = String(process.env.ADMIN_BOOTSTRAP_PASSWORD || '')
  if (!uri || !email || password.length < 16) throw new Error('Set MONGODB_URI, ADMIN_BOOTSTRAP_EMAIL and a 16+ character ADMIN_BOOTSTRAP_PASSWORD in taj-forms/backend/.env')
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME || 'taj_forms' })
  const existing: any = await User.findOne({ email })
  if (existing) {
    if (existing.role !== 'admin') throw new Error('This email is already a regular account. Admin role elevation is refused; use a separate admin email.')
    throw new Error('An admin account already exists for this email; no changes were made.')
  }
  const user = await User.create({ email, name: 'TAJ Forms Administrator', passwordHash: await bcrypt.hash(password, 12), role: 'admin' })
  console.info(`Created Forms platform admin: ${user.email}`)
  await mongoose.disconnect()
}

run().catch(async (error) => {
  console.error(error.message)
  await mongoose.disconnect().catch(() => undefined)
  process.exitCode = 1
})
