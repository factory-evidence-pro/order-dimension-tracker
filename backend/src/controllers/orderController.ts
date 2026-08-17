import { Request, Response } from 'express';
import { OrderService } from '../services/orderService';
import { BigSellerService } from '../services/bigSellerService';
import { query } from '../config/database';
import logger from '../utils/logger';

export class OrderController {
    static async getOrders(req: any, res: Response) {
        try {
            const { search, startDate, endDate, status, page, limit } = req.query;
            const result = await OrderService.getOrders(
                { search, startDate, endDate, status, page, limit },
                req.user.id,
                req.user.role
            );
            res.json({ success: true, ...result });
        } catch (error: any) {
            logger.error('Get orders error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async getOrderByTracking(req: any, res: Response) {
        try {
            const { trackingNumber } = req.params;
            const order = await OrderService.getOrderByTracking(
                trackingNumber,
                req.user.id,
                req.user.role
            );
            res.json({ success: true, data: order });
        } catch (error: any) {
            if (error.message === 'Order not found') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    }

    static async saveDimensions(req: any, res: Response) {
        try {
            const { 
                trackingNumber, 
                dimensions, 
                orderNumber, 
                skus, 
                quantity,
                forceOverwrite = false 
            } = req.body;

            if (!trackingNumber || !dimensions) {
                return res.status(400).json({ 
                    error: 'Tracking number and dimensions required' 
                });
            }

            try {
                const order = await OrderService.saveDimensions(
                    trackingNumber,
                    dimensions,
                    req.user.id,
                    req.user.email,
                    req.user.role,
                    { orderNumber, skus, quantity },
                    forceOverwrite
                );

                res.json({ 
                    success: true, 
                    data: order, 
                    message: order.message || 'Dimensions saved successfully' 
                });
            } catch (error: any) {
                // ✅ Handle duplicate scan error specifically
                if (error.message.includes('DUPLICATE_SCAN')) {
                    return res.status(409).json({
                        error: error.message,
                        errorCode: 'DUPLICATE_SCAN',
                        existingDimensions: error.message.match(/\(([^)]+)\)/)?.[1],
                        trackingNumber,
                        canForceOverwrite: true
                    });
                }
                throw error;
            }
        } catch (error: any) {
            logger.error('Save dimensions error:', error);
            res.status(error.message.includes('Invalid') ? 400 : 500).json({ 
                error: error.message 
            });
        }
    }

    // ✅ New endpoint: Force overwrite dimensions
    static async forceOverwriteDimensions(req: any, res: Response) {
        try {
            const { trackingNumber, dimensions, orderNumber, skus, quantity } = req.body;

            if (!trackingNumber || !dimensions) {
                return res.status(400).json({ 
                    error: 'Tracking number and dimensions required' 
                });
            }

            const order = await OrderService.saveDimensions(
                trackingNumber,
                dimensions,
                req.user.id,
                req.user.email,
                req.user.role,
                { orderNumber, skus, quantity },
                true // ✅ forceOverwrite = true
            );

            res.json({ 
                success: true, 
                data: order, 
                message: 'Dimensions force updated successfully' 
            });
        } catch (error: any) {
            logger.error('Force overwrite error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async checkOrderExists(req: any, res: Response) {
        try {
            const { trackingNumber } = req.params;
            
            // ✅ Check both BigSeller and Database
            const existsInBigSeller = await BigSellerService.checkOrderExists(trackingNumber);
            const existsInDb = await OrderService.getOrderByTracking(
                trackingNumber,
                req.user.id,
                req.user.role
            ).then(() => true).catch(() => false);

            res.json({ 
                success: true, 
                existsInBigSeller,
                existsInDb,
                trackingNumber 
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async refreshData(req: any, res: Response) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const result = await BigSellerService.refreshFromGoogleDrive();
            res.json({
                success: true,
                message: `Refreshed ${result.orders} orders from ${result.files} files`,
                stats: result
            });
        } catch (error: any) {
            logger.error('Refresh error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async exportOrders(req: any, res: Response) {
        try {
            const { startDate, endDate } = req.query;

            let queryText = `
                SELECT order_number, tracking_number, skus, quantity,
                       dimensions, weight, status, date_scanned,
                       duplicate_scan_count
                FROM orders
                WHERE deleted_at IS NULL
            `;

            let params: any[] = [];
            let paramIndex = 1;

            if (startDate) {
                queryText += ` AND date_scanned >= $${paramIndex++}`;
                params.push(startDate);
            }
            if (endDate) {
                queryText += ` AND date_scanned <= $${paramIndex++}`;
                params.push(`${endDate}T23:59:59`);
            }
            if (req.user.role !== 'admin') {
                queryText += ` AND scanned_by = $${paramIndex++}`;
                params.push(req.user.id);
            }

            queryText += ` ORDER BY date_scanned DESC`;

            const result = await query(queryText, params);

            // ✅ Include duplicate info in export
            const headers = [
                'Order Number', 'Tracking Number', 'SKUs', 'Qty', 
                'Dimensions', 'Weight', 'Status', 'Date Scanned',
                'Duplicate Scans'
            ];
            
            let csv = headers.join(',') + '\n';
            result.rows.forEach((row: any) => {
                csv += [
                    row.order_number,
                    row.tracking_number,
                    row.skus,
                    row.quantity,
                    row.dimensions,
                    row.weight,
                    row.status,
                    row.date_scanned,
                    row.duplicate_scan_count || 0
                ].map(v => `"${v || ''}"`).join(',') + '\n';
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=orders-${new Date().toISOString().split('T')[0]}.csv`);
            res.send(csv);
        } catch (error: any) {
            logger.error('Export error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // ✅ New: Get duplicate report (Admin only)
    static async getDuplicateReport(req: any, res: Response) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const report = await OrderService.getDuplicateReport(req.user.role);
            res.json({ success: true, data: report });
        } catch (error: any) {
            logger.error('Duplicate report error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // ✅ New: Get daily stats (Admin only)
    static async getDailyStats(req: any, res: Response) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const stats = await OrderService.getDailyStats(req.user.role);
            res.json({ success: true, data: stats });
        } catch (error: any) {
            logger.error('Daily stats error:', error);
            res.status(500).json({ error: error.message });
        }
    }
}
