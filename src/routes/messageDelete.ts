import { z } from "zod";
import type { ApiRoute } from "../schemas/schemas.ts";
import { EVENTS, io, socketList } from "../services/wsService.ts";
import { messagesDb } from "../services/dbService.ts";

const validation = z.object({
    messageId: z.string().transform(v => new Object(v)),
    recieverId: z.string()
})

const route:ApiRoute = {
    method: 'delete',
    path: '/messages',
    run: (req, res) => {
        const {data, success} = validation.safeParse(req.body)
        if(!success) return res.status(400).send({status:400, message: "Invalid body"});
        const socketId = socketList.get(data.recieverId)
        if(!socketId) {
            messagesDb.insertOne({
                receiverId: data.recieverId,
                status: 'pending',
                type: 'delete',
                timestamp: new Date(),
                senderId: req.user.userId,
            }).then(() => res.sendStatus(204))
            .catch(() => res.status(500).send({status:500, message: "Internal server error"}))
            return;
        }
        const socket = io.sockets.sockets.get(socketId)
        if(!socket) {
            socketList.delete(socketId)
            messagesDb.insertOne({
                receiverId: data.recieverId,
                status: 'pending',
                type: 'delete',
                timestamp: new Date(),
                senderId: req.user.userId,
            }).then(() => res.sendStatus(204))
            .catch(() => res.status(500).send({status:500, message: "Internal server error"}))
            return;
        }
        socket.emit(EVENTS.MESSAGEDELETE, {
            senderId: req.user.userId,
            messageId: data.messageId
        }, () => res.sendStatus(204))
        
    }
}