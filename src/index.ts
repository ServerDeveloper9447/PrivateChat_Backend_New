import {createServer} from 'node:http'
import express, { type RequestHandler } from 'express'
import { config } from 'dotenv'
import { connectDb, usersDb } from './services/dbService.ts'
import { restAuthMiddleware, type AuthenticatedRequest } from './services/authService.ts'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readdirSync } from 'node:fs'
import type { ApiRoute } from './schemas/schemas.ts'
config()

const app = express()
export const server = createServer(app)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const routesPath = path.join(__dirname, '/routes')
const files = readdirSync(routesPath)

for(const file of files) {
    if(!file.endsWith('.ts')) continue;
    const modulePath =  path.join(routesPath, file)
    const {default: route}: {default: ApiRoute} = await import(modulePath)
    app[route.method](route.path, ...(route.middlewares ?? []).map(m => m as RequestHandler), (req, res) => route.run(req as AuthenticatedRequest, res))
}

app.use('/api', (req, res, next) => {restAuthMiddleware(req as AuthenticatedRequest, res, next)})

connectDb()
app.listen(process.env.PORT ?? 3000, () => {
    console.log("Server Started.")
})