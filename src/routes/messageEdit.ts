import { z } from "zod";
import type { ApiRoute } from "../schemas/schemas.ts";
import { io, socketList } from "../services/wsService.ts";
import { messagesDb } from "../services/dbService.ts";
import { ObjectId } from "mongodb";
import { EVENTS } from "../index.ts";

const valid = z.object({
    messageId: z.string().transform(v => new ObjectId(v)),
    content: z.string(),
    recieverId: z.string()
})

const route:ApiRoute = {
    method: 'patch',
    path: '/api/messages',
    run: async (req, res) => {
        const {success, data} = valid.safeParse(req.body)
        if(!success) return res.status(400).send({status:400, message: "bad request"});
        const socketId = socketList.get(data.recieverId)
        if(!socketId) {
            messagesDb.insertOne({
                receiverId: data.recieverId,
                senderId: req.user.userId,
                status: 'pending',
                type: 'edit',
                expireAt: new Date(Date.now() + 90*24*60*60),
                timestamp: new Date(),
                payload: data.content,
                messageId: data.messageId
            }).then(() => res.send({status:200, message: "OK", data: {
                delivered: false
            }})).catch(() => res.status(500).send({status:500, message: "Internal server error"}))
            return;
        }

        const socket = io.sockets.sockets.get(socketId)
        if(!socket) {
            socketList.delete(data.recieverId)
            messagesDb.insertOne({
                receiverId: data.recieverId,
                senderId: req.user.userId,
                status: 'pending',
                type: 'edit',
                expireAt: new Date(Date.now() + 90*24*60*60),
                timestamp: new Date(),
                payload: data.content,
                messageId: data.messageId
            }).then(() => res.send({status:200, message: "OK", data: {
                delivered: false
            }})).catch(() => res.status(500).send({status:500, message: "Internal server error"}))
            return;
        }
        socket.emit(EVENTS.MESSAGEEDIT,{
            senderId: req.user.userId,
            content: data.content,
            messageId: data.messageId
        }, () => res.send({status:200, message: "OK", data: {
                delivered: true
            }}))
        
    }
}

export default route;