import type { AuthenticatedRequest } from "../services/authService.ts";
import express, { type NextFunction } from 'express'

export interface ApiRoute {
    method: 'get' | 'post' | 'delete' | 'patch',
    path: string,
    run: (req: AuthenticatedRequest, res: express.Response) => any,
    middlewares?: ((req: AuthenticatedRequest, res: express.Response, next: NextFunction) => void)[]
}