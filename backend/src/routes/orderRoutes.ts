import { Router } from 'express';
import { OrderController } from '../controllers/orderController';
import { authenticate, authorize } from '../middleware/auth';
import { rateLimiter, writeLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/orders', authenticate, rateLimiter, OrderController.getOrders);
router.get('/orders/:trackingNumber', authenticate, rateLimiter, OrderController.getOrderByTracking);
router.post('/orders/save', authenticate, writeLimiter, OrderController.saveDimensions);
router.get('/orders/check/:trackingNumber', authenticate, rateLimiter, OrderController.checkOrderExists);
router.post('/refresh', authenticate, authorize('admin'), OrderController.refreshData);
router.get('/export', authenticate, rateLimiter, OrderController.exportOrders);

export default router;