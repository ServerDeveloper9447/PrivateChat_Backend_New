import { Server, Socket } from "socket.io";
import type { User } from "../schemas/dbSchemas.ts";
import { wssAuthMiddleware } from "./authService.ts";
import { usersDb } from "./dbService.ts";
import { server } from "../index.ts";

export const io = new Server(server)

export interface AuthenticatedSocket extends Socket {
    user: User
}

export const socketList = new Map<string, string>()
io.use((socket, next) => {
    wssAuthMiddleware(socket as AuthenticatedSocket, next)
})
io.on('connection', async (socket) => {
    const authedSocket = socket as AuthenticatedSocket
    socketList.set(authedSocket.user.userId, authedSocket.id)
    socket.emit('user:online', authedSocket.user.userId)
    usersDb.updateOne({userId: authedSocket.user.userId}, {$set: {isOnline: true, lastActive: new Date()}})
})

io.on('disconnect', (socket) => {
    const authedSocket = socket as AuthenticatedSocket
    socketList.delete(authedSocket.user.userId)
    socket.emit('user:offline', authedSocket.user.userId)
    usersDb.updateOne({userId: authedSocket.user.userId}, {$set: {isOnline: false, lastActive: new Date()}})
})