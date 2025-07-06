import type { ApiRoute } from "../schemas/schemas.ts";
import { eventsDb, messagesDb, usersDb } from "../services/dbService.ts";

const route:ApiRoute = {
    method: 'delete',
    path: '/api/users',
    run: async (req, res) => {
        try {
            const messages = await messagesDb.deleteMany({receiverId: req.user.userId})
            if(!messages.acknowledged) return res.status(500).send({status:500, message: "Internal server error."});
            const event = await eventsDb.deleteMany({recieverId: req.user.userId})
            const user = await usersDb.deleteOne({userId: req.user.userId})
            if(!(user.acknowledged && event.acknowledged)) return res.status(500).send({status:500, message: "Internal server error."});
            res.sendStatus(204)
        } catch(err) {
            console.trace(err)
            res.status(500).send({status:500, message: "Internal server error"})
        }
    }
}

export default route