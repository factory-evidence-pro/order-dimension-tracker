import { Router } from 'express';
import { OrderController } from '../controllers/orderController';
import { authenticate, authorize } from '../middleware/auth';
import { rateLimiter, writeLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public routes (with auth)
router.get('/orders', authenticate, rateLimiter, OrderController.getOrders);
router.get('/orders/:trackingNumber', authenticate, rateLimiter, OrderController.getOrderByTracking);

// Write operations with duplicate handling
router.post('/orders/save', authenticate, writeLimiter, OrderController.saveDimensions);
router.post('/orders/force-overwrite', authenticate, writeLimiter, OrderController.forceOverwriteDimensions);

// Check order
router.get('/orders/check/:trackingNumber', authenticate, rateLimiter, OrderController.checkOrderExists);

// Admin only
router.post('/refresh', authenticate, authorize('admin'), OrderController.refreshData);
router.get('/export', authenticate, rateLimiter, OrderController.exportOrders);
router.get('/admin/duplicates', authenticate, authorize('admin'), OrderController.getDuplicateReport);
router.get('/admin/stats/daily', authenticate, authorize('admin'), OrderController.getDailyStats);

export default router;
