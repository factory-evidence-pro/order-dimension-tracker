import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis';
import logger from '../utils/logger';

export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    const key = `rate:${req.ip}`;
    try {
        const current = await redis.incr(key);
        if (current === 1) {
            await redis.expire(key, Math.floor(parseInt(process.env.RATE_LIMIT_WINDOW_MS!) / 1000));
        }
        if (current > parseInt(process.env.RATE_LIMIT_MAX_REQUESTS!)) {
            const ttl = await redis.ttl(key);
            return res.status(429).json({
                error: 'Too many requests',
                retryAfter: ttl
            });
        }
        next();
    } catch (error) {
        logger.error('Rate limiter error:', error);
        next();
    }
};

export const writeLimiter = async (req: Request, res: Response, next: NextFunction) => {
    const key = `rate:write:${req.ip}`;
    try {
        const current = await redis.incr(key);
        if (current === 1) {
            await redis.expire(key, Math.floor(parseInt(process.env.RATE_LIMIT_WRITE_WINDOW_MS!) / 1000));
        }
        if (current > parseInt(process.env.RATE_LIMIT_WRITE_MAX!)) {
            return res.status(429).json({
                error: 'Too many write operations'
            });
        }
        next();
    } catch (error) {
        logger.error('Write rate limiter error:', error);
        next();
    }
};