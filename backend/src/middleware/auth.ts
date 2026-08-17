import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/database';
import logger from '../utils/logger';

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                username: string;
                role: string;
            };
            requestId?: string;
        }
    }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

        const { data: user } = await supabase
            .from('users')
            .select('id, email, username, role, is_active')
            .eq('id', decoded.userId)
            .single();

        if (!user || !user.is_active) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expired' });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        logger.error('Auth error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: roles,
                userRole: req.user.role
            });
        }
        next();
    };
};