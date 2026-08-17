import Redis from 'ioredis';
import logger from '../utils/logger';

const redis = new Redis(process.env.REDIS_URL!, {
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
    }
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (error) => logger.error('Redis error:', error));

export default redis;