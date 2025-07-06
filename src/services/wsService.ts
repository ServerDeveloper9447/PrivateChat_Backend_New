import { Server, Socket } from "socket.io";
import { EventSchema, type User } from "../schemas/dbSchemas.ts";
import { wssAuthMiddleware } from "./authService.ts";
import { eventsDb, usersDb } from "./dbService.ts";
import { EVENTS, server } from "../index.ts";

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
    socket.emit(EVENTS.USERONLINE, authedSocket.user.userId)
    usersDb.updateOne({userId: authedSocket.user.userId}, {$set: {isOnline: true, lastActive: new Date()}})
})

io.on('disconnect', (socket) => {
    const authedSocket = socket as AuthenticatedSocket
    socketList.delete(authedSocket.user.userId)
    socket.emit(EVENTS.USEROFFLINE, authedSocket.user.userId)
    usersDb.updateOne({userId: authedSocket.user.userId}, {$set: {isOnline: false, lastActive: new Date()}})
})

io.on(EVENTS.LASTREAD, (socket) => {
    const authed = socket as AuthenticatedSocket
    const {data, success} = EventSchema.safeParse(authed)
    if(!success) return authed.emit(EVENTS.DATAERROR,{event:EVENTS.DATAERROR});
    const socketId = socketList.get(data.recieverId)
    if(!socketId) {
        eventsDb.insertOne({
            createdBy: authed.user.userId,
            type: EVENTS.LASTREAD,
            recieverId: data.recieverId,
            timestamp: new Date()
        })
        return;
    }
    const sck = io.sockets.sockets.get(socketId)
    if(!sck) {
        socketList.delete(socketId)
        eventsDb.insertOne({
            createdBy: authed.user.userId,
            type: EVENTS.LASTREAD,
            recieverId: data.recieverId,
            timestamp: new Date()
        })
        return;
    }

    sck.emit(EVENTS.LASTREAD,{
        senderId: authed.user.userId,
        timestamp: new Date()
    })
})