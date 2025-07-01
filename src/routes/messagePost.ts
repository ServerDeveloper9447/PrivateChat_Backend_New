import { z } from "zod";
import type { ApiRoute } from "../schemas/schemas.ts";
import { messagesDb } from "../services/dbService.ts";
import { EVENTS, io, socketList } from "../services/wsService.ts";
import { deserialize } from "mongodb";

const valid = z.object({
    payload: z.string().min(1, "Payload is required"),
    recieverId: z.string().min(1, 'Receiver ID is required')
})

const route:ApiRoute = {
    method: 'post',
    path: '/messages',
    run: async (req, res) => {
        const {success, data} = valid.safeParse(req.body)
        if(!success) return res.status(400).send({status:400, message: "Bad request body object"});
        const message = await messagesDb.insertOne({
                payload: data.payload,
                senderId: req.user.userId,
                receiverId: data.recieverId,
                expireAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                timestamp: new Date(),
                status: 'pending',
                type: "message"
            })
        const socketId = socketList.get(data.recieverId)
        if(!socketId) {
            return res.send({status:200, message: "OK", data: {
                messageId: message.insertedId,
                delivered: false
            }})
        } else {
            const socket = io.sockets.sockets.get(socketId)
            if(!socket) {
                socketList.delete(data.recieverId)
                return res.send({status:200, message: "OK", data: {
                    messageId: message.insertedId,
                    delivered: false
                }})
            } else {
                socket.emit(EVENTS.MESSAGE, {
                    payload: data.payload,
                    senderId: req.user.userId,
                    timestamp: new Date(),
                    id: message.insertedId
                }, () => res.send({status:200, message: "OK", data: {
                        messageId: message.insertedId,
                        delivered: true
                    }}))
                
            }
        }
    }
}