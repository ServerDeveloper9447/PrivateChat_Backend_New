import express, { RequestHandler } from 'express'
import { config } from 'dotenv'
import { createServer } from 'node:http'
import path from 'node:path'
import { readdirSync } from 'node:fs'
import { ApiRoute } from './schemas/schemas.ts'
import { AuthenticatedRequest, restAuthMiddleware, TOKEN_TYPES } from './services/authService.ts'
import { z } from 'zod'
import { connectDb, db, usersDb } from './services/dbService.ts'
import { JwtPayload, sign, verify } from 'jsonwebtoken'
import os from 'node:os'

config()

const app = express()
export const server = createServer(app)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

export const EVENTS: Record<string, string> = {
    MESSAGE: 'user:chat_message',
    MESSAGEEDIT: 'user:chat_message_edit',
    MESSAGEDELETE: 'user:chat_message_delete',
    LASTREAD: 'user:last_read',
    DATAERROR: 'system:data_error',
    CLEARDATA: 'admin:clear_data',
    LOGOUT: 'admin:remote_logout',
    USERONLINE: 'user:online',
    USEROFFLINE: 'user:offline',
    CONNECT: 'user:connect',
    DISCONNECT: 'user:disconnect'
}
Object.freeze(EVENTS)

const routesPath = path.join(__dirname, '/routes')
const files = readdirSync(routesPath)

for (const file of files) {
    if (!file.endsWith('.ts')) continue;
    const modulePath = path.join(routesPath, file)
    import(modulePath).then((module) => {
        const route = module.default as ApiRoute
        app[route.method](route.path, ...(route.middlewares ?? []).map(m => m as RequestHandler), (req, res) => route.run(req as AuthenticatedRequest, res))
        console.log(`[${route.method}] ${route.path}: loaded`)
    })
}

app.use('/api', (req, res, next) => { restAuthMiddleware(req as AuthenticatedRequest, res, next) })

app.post('/users', async (req, res) => {
    const { data, success } = z.object({
        username: z.string(),
        password: z.string()
    }).safeParse(req.body)
    if (!success) {
        res.status(400).send({ status: 400, message: "Bad request." })
        return;
    }
    try {
        const user = await usersDb.findOne({ username: data.username })
        if (!user) {
            res.status(404).send({ status: 404, message: "Cannot find user" })
            return;
        }
        const isValid = Bun.password.verifySync(data.password, user.password);
        if (!isValid) {
            res.status(401).send({ status: 401, message: "Unauthorized" })
            return;
        }
        const access_token = sign({ userId: user.userId, type: TOKEN_TYPES.ACCESS_TOKEN }, process.env.JWT_KEY as string, { expiresIn: '1d' })
        const refresh_token = sign({ userId: user.userId, type: TOKEN_TYPES.REFRESH_TOKEN }, process.env.JWT_KEY as string, { expiresIn: '7d' })
        await usersDb.updateOne({ userId: user.userId }, { $set: { refreshToken: refresh_token } })
        res.send({ status: 200, message: "OK", data: { access_token, refresh_token } });
    } catch (err) {
        console.trace(err)
        res.status(500).send({ status: 500, message: "Internal server error" })
    }
})

app.post('/refreshToken', async (req, res) => {
    const { data, success } = z.object({
        refresh_token: z.string()
    }).safeParse(req.body)
    if (!success) {
        res.status(400).send({ status: 400, message: "Bad request body object" })
        return;
    }
    try {
        const decoded = verify(data.refresh_token, process.env.JWT_KEY as string) as JwtPayload
        if (Number(decoded.type) != TOKEN_TYPES.REFRESH_TOKEN) {
            res.status(400).send({ status: 400, message: "Invalid token type" })
            return;
        }
        const user = await usersDb.findOne({ userId: decoded.userId })
        if (!user) {
            res.status(404).send({ status: 404, message: "Cannot find user" })
            return;
        }
        if (user.refreshToken != data.refresh_token) {
            res.status(401).send({ status: 401, message: "Unauthorized" })
            return;
        }
        const access_token = sign({ userId: decoded.userId, type: TOKEN_TYPES.ACCESS_TOKEN }, process.env.JWT_KEY as string, { expiresIn: '1d' })
        res.send({ status: 200, message: "OK", data: { access_token } });
    } catch (err: any) {
        if (err.name == 'TokenExpiredError') {
            res.status(400).send({ status: 400, message: "Token has been expired. Please re-login to get a new refresh_token." })
        } else if (err.name == 'JsonWebTokenError') {
            res.status(400).send({ status: 400, message: "Invalid token" })
        } else {
            console.trace(err)
            res.status(500).send({ status: 500, message: "Internal server " })
        }
    }
})

app.get('/status', async (req, res) => {
    res.send({
        status: 200, message: "OK", data: req.query.debug ? ({
            cpus: os.cpus(),
            platform: os.platform(),
            arch: os.arch(),
            free_memory: `${(os.freemem() / 1024 / 1024).toFixed(2)} MB`,
            db_ping: await db.command({ ping: 1 })
        }) : undefined
    })
})

connectDb(() => {
    app.listen(process.env.PORT ?? 3000, () => {
        console.log("Listening at port", process.env.PORT ?? 3000)
    })
})