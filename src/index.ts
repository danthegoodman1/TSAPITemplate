import * as dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import cors from 'cors'

import { logger } from './logger/index.js'
import { ConnectDB } from './db/index.js'
import { extractError } from './utils.js'

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

  // Connect DB
  try {
    await ConnectDB()
  } catch (error: any) {
    logger.error({ err: extractError(error) }, "failed to connect to db")
    process.exit(1)
  }

  app.use((req, res, next) => {
    const reqID = uuidv4()
    req.id = reqID
    res.header('X-Request-ID', reqID)
    next()
  })

  if (process.env.HTTP_LOG === "1") {
    logger.debug("using HTTP logger")
    app.use((req: any, res, next) => {
      req.log.info({ req })
      res.on("finish", () => req.log.info({ res }))
      next()
    })
  }

  app.get('/hc', (req, res) => {
    res.sendStatus(200)
  })

  const server = app.listen(listenPort, () => {
    logger.info(`API listening on port ${listenPort}`)
  })

  const signals = {
    SIGHUP: 1,
    SIGINT: 2,
    SIGTERM: 15,
  }

  let stopping = false
  Object.keys(signals).forEach((signal) => {
    process.on(signal, async () => {
      if (stopping) {
        return
      }
      stopping = true
      logger.info(`Received signal ${signal}, shutting down...`)
      logger.info("exiting...")
      process.exit(0)
    })
  })
}

main()
