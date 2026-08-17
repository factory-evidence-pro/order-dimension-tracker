import { Request, Response } from 'express';
import { query } from '../config/database';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger';

export class AdminController {
    static async getUsers(req: any, res: Response) {
        try {
            const result = await query(`
                SELECT id, email, username, full_name, role, last_login, created_at, is_active
                FROM users
                ORDER BY created_at DESC
            `);
            res.json({ success: true, data: result.rows });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async createUser(req: any, res: Response) {
        try {
            const { email, username, password, fullName, role } = req.body;

            if (!['admin', 'user'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const result = await query(`
                INSERT INTO users (email, username, password_hash, full_name, role)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, email, username, full_name, role, created_at
            `, [email, username, hashedPassword, fullName, role]);

            res.json({ success: true, data: result.rows[0], message: 'User created' });
        } catch (error: any) {
            if (error.code === '23505') {
                res.status(400).json({ error: 'Email or username already exists' });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    }

    static async updateUser(req: any, res: Response) {
        try {
            const { id } = req.params;
            const { fullName, role, isActive } = req.body;

            const result = await query(`
                UPDATE users
                SET full_name = COALESCE($1, full_name),
                    role = COALESCE($2, role),
                    is_active = COALESCE($3, is_active)
                WHERE id = $4
                RETURNING id, email, username, full_name, role, is_active
            `, [fullName, role, isActive, id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ success: true, data: result.rows[0], message: 'User updated' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async deleteUser(req: any, res: Response) {
        try {
            const { id } = req.params;

            if (id === req.user.id) {
                return res.status(400).json({ error: 'Cannot delete your own account' });
            }

            const result = await query(`
                UPDATE users SET is_active = false WHERE id = $1
                RETURNING id, email, username
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ success: true, message: 'User deactivated', data: result.rows[0] });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getDatabaseStats(req: any, res: Response) {
        try {
            const stats = await query(`
                SELECT
                    (SELECT COUNT(*) FROM users) as total_users,
                    (SELECT COUNT(*) FROM orders) as total_orders,
                    (SELECT COUNT(*) FROM orders WHERE status = 'SAVED') as saved_orders,
                    (SELECT COUNT(*) FROM orders WHERE status = 'PENDING') as pending_orders,
                    (SELECT COUNT(*) FROM orders WHERE date_scanned > NOW() - INTERVAL '7 days') as weekly_orders,
                    (SELECT COUNT(*) FROM orders WHERE date_scanned > NOW() - INTERVAL '1 day') as daily_orders,
                    (SELECT pg_database_size(current_database()) / 1024 / 1024) as db_size_mb
            `);
            res.json({ success: true, data: stats.rows[0] });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}