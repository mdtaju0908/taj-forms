import mongoose from 'mongoose'
import { config } from './config.js'

export const connectDatabase = async () => {
  await mongoose.connect(config.MONGODB_URI, {
    dbName: config.MONGODB_DB_NAME,
    autoIndex: config.NODE_ENV !== 'production',
    serverSelectionTimeoutMS: 5000,
  })
  await Promise.all([mongoose.model('TajFormsUser').init(), mongoose.model('TajFormsSession').init(), mongoose.model('TajFormsForm').init(), mongoose.model('TajFormsSubmission').init(), mongoose.model('TajFormsReport').init(), mongoose.model('TajFormsAudit').init(), mongoose.model('TajFormsSetting').init()])
}
