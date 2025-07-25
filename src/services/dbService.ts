import { MongoClient, ServerApiVersion } from "mongodb";
import { type User, type Message, type Event } from "../schemas/dbSchemas.ts";

export const dbClient = new MongoClient(process.env.MONGODB_URI as string,{
    serverApi:{
        version: ServerApiVersion.v1,
        deprecationErrors: true,
        strict: true
    }
})
export const db = dbClient.db('Main')
export const usersDb = db.collection<User>('Users')
export const messagesDb = db.collection<Message>('Messages')
export const eventsDb = db.collection<Event>('Events')

export function connectDb(callback: () => void, skipUserDbClean: boolean = false) {
    dbClient.connect()
    .then(() => {
        console.log("Connected to DB")
        usersDb.bulkWrite([{
        "updateMany": {
            "filter": {},
            "update": {
                "$set": {
                    "isOnline": false,
                    "lastActive": new Date()
                }
            }
        }
    }])
    .then(() => {
        console.log("User database re-init complete")
        callback()
    })
    .catch(() => {
        if(skipUserDbClean) {
            console.error("Cannot re-init user db. Please check your access. Skipping safe exit.")
        } else {
            console.error("Cannot re-init user db. Please check your access.")
            process.exit(1)
        }
    })
    })
    .catch(() => {
        console.error("Cannot connect to database")
        process.exit(1)
    })
}