// The Upstash Redis store of the stage-1 service. Without the two environment names there is no store: the
// endpoints still validate and answer, with 503 once a request is valid.
import { Redis } from '@upstash/redis';
import type { S1Store } from './handler';

export function upstashStore(env: Record<string, string | undefined> = process.env): S1Store | null {
  // the Vercel Marketplace integration names the pair KV_REST_API_*; a database linked by hand, UPSTASH_REDIS_REST_*
  const url = env['UPSTASH_REDIS_REST_URL'] ?? env['KV_REST_API_URL'];
  const token = env['UPSTASH_REDIS_REST_TOKEN'] ?? env['KV_REST_API_TOKEN'];
  if (!url || !token) return null;
  const redis = new Redis({ url, token });
  return {
    async incr(key, ttlSeconds) {
      // NX: the expiry is set when the key has none, so a retry after a failed EXPIRE still sets it
      const [n] = await redis.pipeline().incr(key).expire(key, ttlSeconds, 'NX').exec<[number, number]>();
      return n;
    },
    async sadd(key, member, ttlSeconds) {
      await redis.pipeline().sadd(key, member).expire(key, ttlSeconds, 'NX').exec();
    },
    async push(key, value, keep) {
      await redis.pipeline().lpush(key, value).ltrim(key, 0, keep - 1).exec();
    },
  };
}
