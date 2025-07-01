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
      log: typeof logger
    }
  }

  namespace NodeJS {
    interface ProcessEnv {
      API_TOKEN: string
      HTTP_LOG: string
    }
  }
}

async function main() {

  const app = express()
  app.use(express.json())
  app.disable("x-powered-by")
  app.use(cors())

  app.use((req: any, res: any, next: any) => {
    const reqID = uuidv4()
    req.id = reqID
    req.log = logger.child({ requestId: reqID })
    res.header("X-Request-ID", req.id)
    next()
  })

  if (process.env.HTTP_LOG === "1") {
    app.use((req: any, res, next) => {
      const startTime = Date.now()

      // Log request details
      req.log.info({
        type: "request",
        method: req.method,
        url: req.url,
        headers: req.headers,
        bodyLength: req.get("content-length")
          ? parseInt(req.get("content-length")!)
          : 0,
        userAgent: req.get("user-agent"),
        ip: req.ip,
      })

      // Log response details when finished
      res.on("finish", () => {
        const duration = Date.now() - startTime
        const contentLength = res.get("content-length")
        req.log.info({
          type: "response",
          statusCode: res.statusCode,
          headers: res.getHeaders(),
          bodyLength: contentLength ? parseInt(contentLength) : 0,
          duration: `${duration}ms`,
        })
      })

      next()
    })
  }

  app.get("/hc", (_req, res) => {
    res.sendStatus(200)
  })

  app.use((err: any, req: any, res: any, _next: any) => {
    // if (err instanceof ZodError) {
    //   return res.status(400).send(`Invalid body: ${err.message}`)
    // }

    logger.error({ err: extractError(err), id: req.id })
    res.status(500).send("Internal Server Error")
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
      logger.flush() // pino actually fails to flush, even with awaiting on a callback
      server.close()
      process.exit(0)
    })
  })
}

main()
