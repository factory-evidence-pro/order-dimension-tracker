import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import logger from '../utils/logger';

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    logger.error('Database pool error:', err);
});

export const query = async (text: string, params?: any[]) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 1000) {
            logger.warn(`Slow query (${duration}ms):`, { text });
        }
        return result;
    } catch (error) {
        logger.error('Database query error:', { text, error });
        throw error;
    }
};

export const transaction = async <T>(callback: (client: any) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
);

export const healthCheck = async (): Promise<boolean> => {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch {
        return false;
    }
};