import { z } from "zod";
import type { ApiRoute } from "../schemas/schemas.ts";
import { usersDb } from "../services/dbService.ts";

const obj = z.object({
    avatar: z.string().url('Invalid URL format').optional(),
    username: z.string().optional()
}).refine(data => Object.values(data).some(w => w != undefined),{message:"Atleast one property must be present"})

const route:ApiRoute = {
    method: 'patch',
    path: '/api/users',
    run: (req, res) => {
        const parsed = obj.safeParse(req.body)
        if(!parsed.success) return res.status(400).send({status:400, message: "Bad request body object"});
        usersDb.updateOne({userId:req.user.userId},parsed.data)
        .then(() => res.send({status:200, message: "OK"}))
        .catch(() => res.status(500).send({status:500, message: "Internal server error"}))
    }
}

export default route