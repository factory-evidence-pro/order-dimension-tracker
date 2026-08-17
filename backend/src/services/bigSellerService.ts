import { query } from '../config/database';
import redis from '../config/redis';
import logger from '../utils/logger';
import * as XLSX from 'xlsx';
import { google } from 'googleapis';

export class BigSellerService {
    private static readonly CACHE_TTL = 3600; // 1 hour

    static async getOrderData(trackingNumber: string): Promise<any> {
        try {
            // Check cache first
            const cacheKey = `bigseller:${trackingNumber}`;
            const cached = await redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            // Query from database cache
            const result = await query(
                'SELECT order_data FROM bigseller_cache WHERE tracking_number = $1 AND is_valid = true',
                [trackingNumber]
            );

            if (result.rows.length > 0) {
                const data = result.rows[0].order_data;
                await redis.setex(cacheKey, BigSellerService.CACHE_TTL, JSON.stringify(data));
                return data;
            }

            return null;
        } catch (error) {
            logger.error('BigSeller fetch error:', error);
            return null;
        }
    }

    static async checkOrderExists(trackingNumber: string): Promise<boolean> {
        try {
            const result = await query(
                'SELECT 1 FROM bigseller_cache WHERE tracking_number = $1 AND is_valid = true LIMIT 1',
                [trackingNumber]
            );
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Check order exists error:', error);
            return false;
        }
    }

    static async refreshFromGoogleDrive(): Promise<{ files: number; orders: number }> {
        try {
            // Initialize Google Drive API
            const auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                },
                scopes: ['https://www.googleapis.com/auth/drive.readonly']
            });

            const drive = google.drive({ version: 'v3', auth });

            // Get files from folder
            const response = await drive.files.list({
                q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and (mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel' or mimeType='text/csv')`,
                fields: 'files(id, name, modifiedTime)',
            });

            const files = response.data.files || [];
            let totalOrders = 0;

            for (const file of files) {
                if (file.id && file.name) {
                    const count = await BigSellerService.processFile(file.id, file.name);
                    totalOrders += count;
                }
            }

            return { files: files.length, orders: totalOrders };
        } catch (error) {
            logger.error('Google Drive refresh error:', error);
            throw error;
        }
    }

    private static async processFile(fileId: string, fileName: string): Promise<number> {
        try {
            // This is a simplified version - in production, you'd use the Drive API to download and parse
            logger.info(`Processing file: ${fileName}`);

            // For demo, just log
            return 0;
        } catch (error) {
            logger.error(`Error processing file ${fileName}:`, error);
            return 0;
        }
    }

    static async insertBigSellerData(trackingNumber: string, orderData: any, sourceFile: string): Promise<void> {
        await query(`
            INSERT INTO bigseller_cache (tracking_number, order_data, source_file, last_updated)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (tracking_number)
            DO UPDATE SET
                order_data = EXCLUDED.order_data,
                source_file = EXCLUDED.source_file,
                last_updated = NOW(),
                is_valid = true
        `, [trackingNumber, orderData, sourceFile]);
    }

    static async cleanupCache(): Promise<void> {
        // Clean up old cache entries (older than 7 days)
        await query(`
            DELETE FROM bigseller_cache
            WHERE last_updated < NOW() - INTERVAL '7 days'
            AND is_valid = false
        `);
    }
}