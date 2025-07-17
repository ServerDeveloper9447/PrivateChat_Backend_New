import { verify } from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import type { ExtendedError } from "socket.io";
import type { AuthenticatedSocket } from "./wsService.ts";
import { usersDb } from "./dbService.ts";
import type { NextFunction } from "express";
import express from 'express'
import type { User } from "../schemas/dbSchemas.ts";

export interface AuthenticatedRequest extends express.Request {
    user: User
}

export enum TOKEN_TYPES {
    ACCESS_TOKEN = 1,
    REFRESH_TOKEN = 2
}

const token_regex = /^Bearer\s\S+/gmi;

export const wssAuthMiddleware = async (socket: AuthenticatedSocket, next: (err?: ExtendedError) => void) => {
    let token: string = socket.handshake.auth.token
    if(!token.match(token_regex)) return next(new Error("No auth token provided."));
    token = token.split(" ")[1];
    try {
        const decoded = verify(token, process.env.JWT_KEY as string) as JwtPayload
        if(Number(decoded.type) != TOKEN_TYPES.ACCESS_TOKEN) return next(new Error("Invalid token type"));
        const user = await usersDb.findOne({userId: decoded.userId})
        if(!user) return next(new Error("No user found with the id"));
        if(!user.refreshToken) return next(new Error("Cannot use access_token without logging in."));
        socket.user = user
        next()
    } catch(err: any) {
        if(err.name == 'TokenExpiredError') {
            return next(new Error("Token Expired"))
        } else if(err.name == 'JsonWebTokenError') {
            return next(new Error("Invalid Token"))
        } else {
            console.trace(err)
            return next(new Error("Unexpected Error"))
        }
    }
}

export const restAuthMiddleware = async (req: AuthenticatedRequest, res: express.Response, next: NextFunction) => {
    let token = req.headers.authorization as string
    if(!token.match(token_regex)) return res.status(401).send({status:401, message: "Unauthorized"});
    token = token.split(" ")[1]
    try {
        const decoded = verify(token, process.env.JWT_KEY as string) as JwtPayload
        if(Number(decoded.type) != TOKEN_TYPES.ACCESS_TOKEN) return res.status(400).send({status:400, message: "Invalid token type"});
        const user = await usersDb.findOne({userId: decoded.userId})
        if(!user) return res.status(404).send({status:404, message: "Cannot find user"});
        if(!user.refreshToken) return res.status(401).send({status: 401, message: "Cannot use access_token without logging in."});
        req.user = user
        next()
    } catch(err: any) {
        if(err.name == 'TokenExpiredError') {
            return res.status(400).send({status:1001, message: "Token has been expired"})
        } else if(err.name == 'JsonWebTokenError') {
            return res.status(400).send({status:1002, message: "Invalid token"})
        } else {
            console.trace(err)
            return res.status(500).send({status:500, message: "Internal server "})
        }
    }
}