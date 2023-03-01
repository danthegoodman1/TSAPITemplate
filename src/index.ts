import * as dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import bunyan from 'bunyan'
import { v4 as uuidv4 } from 'uuid'
import cors from 'cors'

import { logger } from './logger'
import { ConnectDB } from './db'

const listenPort = process.env.PORT || '8080'

declare global {
  namespace Express {
    interface Request {
      id: string
    }
  }

  namespace NodeJS {
    interface ProcessEnv {
      API_TOKEN: string
    }
  }
}

async function main() {

  const app = express()
  app.use(express.json())
  app.disable('x-powered-by')
  app.use(cors())

  const log = bunyan.createLogger({
    name: "tsapitemplate",
    serializers: bunyan.stdSerializers,
    level: 'debug'
  })

  // Connect DB
  try {
    await ConnectDB()
  } catch (error: any) {
    log.error({ m: "failed to connect to db", err: error })
    process.exit(1)
  }

  app.use((req, res, next) => {
    const reqID = uuidv4()
    req.id = reqID
    next()
  })

  if (process.env.HTTP_LOG === "1") {
    logger.debug("using HTTP logger")
    app.use((req: any, res, next) => {
      req.log = log.child({ req_id: req.id }, true)
      req.log.info({ req })
      res.on("finish", () => req.log.info({ res }))
      next()
    })
  }

  app.get('/hc', (req, res) => {
    // let log = GetRequestLogger(req)
    // log.info("hey")
    // log = UpdateRequestLogger(log, {
    //   "test": "pro"
    // })
    // log.info("hey with pro")
    res.sendStatus(200)
  })

  const server = app.listen(listenPort, () => {
    logger.info(`API listening on port ${listenPort}`)
  })

  let stopping = false

  process.on('SIGTERM', async () => {
    if (!stopping) {
      stopping = true
      logger.warn('Received SIGTERM command, shutting down...')
      server.close()
      logger.info('exiting...')
      process.exit(0)
    }
  })

  process.on('SIGINT', async () => {
    if (!stopping) {
      stopping = true
      logger.warn('Received SIGINT command, shutting down...')
      server.close()
      logger.info('exiting...')
      process.exit(0)
    }
  })
}

main()
