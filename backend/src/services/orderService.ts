import { query, transaction } from '../config/database';
import redis from '../config/redis';
import logger from '../utils/logger';
import { BigSellerService } from './bigSellerService';

export class OrderService {
    private static readonly CACHE_TTL = 300;

    static async getOrders(filters: any, userId: string, userRole: string) {
        const { search, startDate, endDate, status, page = 1, limit = 50 } = filters;

        let conditions: string[] = ['deleted_at IS NULL'];
        let params: any[] = [];
        let paramIndex = 1;

        if (search) {
            conditions.push(`(tracking_number ILIKE $${paramIndex++} OR order_number ILIKE $${paramIndex++})`);
            params.push(`%${search}%`, `%${search}%`);
        }

        if (status && status !== 'ALL') {
            conditions.push(`status = $${paramIndex++}`);
            params.push(status);
        }

        if (startDate) {
            conditions.push(`date_scanned >= $${paramIndex++}`);
            params.push(startDate);
        }

        if (endDate) {
            conditions.push(`date_scanned <= $${paramIndex++}`);
            params.push(`${endDate}T23:59:59`);
        }

        // Non-admin can only see their own orders
        if (userRole !== 'admin') {
            conditions.push(`scanned_by = $${paramIndex++}`);
            params.push(userId);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const offset = (page - 1) * limit;

        // Get count
        const countResult = await query(
            `SELECT COUNT(*) as total FROM orders ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].total);

        // Get data
        const dataQuery = `
            SELECT
                id, order_number, tracking_number, skus, quantity,
                dimensions, weight, status, date_scanned, date_modified,
                scanned_by, source
            FROM orders
            ${whereClause}
            ORDER BY date_scanned DESC
            LIMIT $${paramIndex++}
            OFFSET $${paramIndex++}
        `;

        params.push(limit, offset);
        const result = await query(dataQuery, params);

        return {
            data: result.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        };
    }

    static async getOrderByTracking(trackingNumber: string, userId: string, userRole: string) {
        // Check cache
        const cacheKey = `order:${trackingNumber}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            const order = JSON.parse(cached);
            if (userRole === 'admin' || order.scanned_by === userId) {
                return order;
            }
        }

        let queryText = `
            SELECT
                id, order_number, tracking_number, skus, quantity,
                dimensions, weight, status, date_scanned, date_modified,
                scanned_by, source
            FROM orders
            WHERE tracking_number = $1 AND deleted_at IS NULL
        `;

        let params: any[] = [trackingNumber];

        if (userRole !== 'admin') {
            queryText += ` AND scanned_by = $2`;
            params.push(userId);
        }

        const result = await query(queryText, params);
        if (result.rows.length === 0) {
            throw new Error('Order not found');
        }

        const order = result.rows[0];
        await redis.setex(cacheKey, OrderService.CACHE_TTL, JSON.stringify(order));
        return order;
    }

    static async saveDimensions(
        trackingNumber: string,
        dimensions: string,
        userId: string,
        userEmail: string,
        userRole: string,
        additionalData?: any
    ) {
        return await transaction(async (client) => {
            // Validate dimensions
            const dims = dimensions.split('×').map((d: string) => d.trim());
            if (dims.length !== 3 || dims.some(isNaN)) {
                throw new Error('Invalid dimensions format. Use L × W × H');
            }

            // Check if order exists
            const existing = await client.query(
                'SELECT id, dimensions, status FROM orders WHERE tracking_number = $1 AND deleted_at IS NULL',
                [trackingNumber]
            );

            let result;
            if (existing.rows.length > 0) {
                // Update existing
                result = await client.query(`
                    UPDATE orders
                    SET dimensions = $1, status = 'SAVED', date_modified = NOW(), modified_by = $2
                    WHERE tracking_number = $3 AND deleted_at IS NULL
                    RETURNING *
                `, [dimensions, userId, trackingNumber]);
            } else {
                // Get from BigSeller
                const bigSellerData = await BigSellerService.getOrderData(trackingNumber);

                result = await client.query(`
                    INSERT INTO orders (
                        order_number, tracking_number, skus, quantity,
                        dimensions, weight, status, scanned_by, source,
                        metadata
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, 'SAVED', $7, 'manual', $8)
                    RETURNING *
                `, [
                    additionalData?.orderNumber || trackingNumber,
                    trackingNumber,
                    additionalData?.skus || bigSellerData?.skus || '',
                    additionalData?.quantity || bigSellerData?.quantity || 0,
                    dimensions,
                    additionalData?.weight || null,
                    userId,
                    { bigseller_data: bigSellerData }
                ]);
            }

            // Invalidate cache
            await redis.del(`order:${trackingNumber}`);
            const keys = await redis.keys('orders:*');
            if (keys.length > 0) {
                await redis.del(...keys);
            }

            return result.rows[0];
        });
    }
}
