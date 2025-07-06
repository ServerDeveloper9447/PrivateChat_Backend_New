import type { ApiRoute } from "../schemas/schemas.ts";
import { usersDb } from "../services/dbService.ts";

const route:ApiRoute = {
    method: 'post',
    path: '/api/users/logout',
    run: (req, res) => {
        usersDb.updateOne({userId: req.user.userId}, {$unset: {refreshToken: 1}})
        .then(() => res.sendStatus(204))
        .catch((err:any) => {
            console.trace(err);
            res.status(500).send({status:500,messsage:"Internal server error"});
        })
    }
}

export default route