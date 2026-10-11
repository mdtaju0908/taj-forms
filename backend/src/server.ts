import { app } from './app.js'
import { config } from './config.js'
import { connectDatabase } from './db.js'
import './models.js'

const start = async () => {
  await connectDatabase()
  const server = app.listen(config.PORT, () => console.info(`[TAJ Forms API] Listening on port ${config.PORT}, database ${config.MONGODB_DB_NAME}`))
  const shutdown = async (signal: string) => {
    console.info(`[TAJ Forms API] ${signal}; shutting down`)
    server.close(async () => {
      const mongoose = await import('mongoose')
      await mongoose.default.disconnect()
      process.exit(0)
    })
    setTimeout(() => process.exit(1), 10000).unref()
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

start().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  const errorName = error instanceof Error ? error.name : ''
  if (errorName === 'MongooseServerSelectionError' || /ECONNREFUSED|EACCES|ENOTFOUND/.test(message)) {
    console.error('[TAJ Forms API] MongoDB is unavailable. Start a local MongoDB service or set MONGODB_URI in taj-forms/backend/.env.')
  }
  console.error('[TAJ Forms API] Startup failed:', message)
  process.exit(1)
})
