import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { healthCheck } from './config/database';
import redis from './config/redis';
import logger from './utils/logger';
import authRoutes from './routes/authRoutes';
import orderRoutes from './routes/orderRoutes';
import adminRoutes from './routes/adminRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', orderRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', async (req, res) => {
    const dbOk = await healthCheck();
    const redisOk = await redis.ping().then(() => true).catch(() => false);
    res.json({
        status: dbOk && redisOk ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: { database: dbOk, redis: redisOk }
    });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
    logger.error('Unhandled error:', err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await redis.quit();
    process.exit(0);
});