import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  if (
    process.env.APP_ENV !== 'staging' ||
    process.env.NODE_ENV !== 'production'
  ) {
    throw new Error(
      'staging infrastructure smoke requires APP_ENV=staging and NODE_ENV=production',
    );
  }
  const databaseUrl = required('DATABASE_URL');
  const redisUrl = required('REDIS_URL');
  const keyPrefix = process.env.REDIS_KEY_PREFIX?.trim() || 'pocha';
  if (!/^staging[_-]/i.test(keyPrefix)) {
    throw new Error('REDIS_KEY_PREFIX must start with staging- or staging_');
  }
  const smokeId = randomUUID();
  const transactionUserId = `${smokeId}-transaction`;
  const username = `staging-smoke-${smokeId}`;
  const redisKey = `${keyPrefix}:staging-smoke:${smokeId}`;
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  try {
    const created = await prisma.user.create({
      data: {
        id: smokeId,
        username,
        displayName: 'Staging smoke',
        authProvider: 'staging-smoke',
        authProviderId: smokeId,
        isGuest: true,
      },
      select: { id: true, username: true, displayName: true },
    });

    const read = await prisma.user.findUnique({
      where: { id: smokeId },
      select: { id: true, username: true, displayName: true },
    });
    if (!read || read.username !== username) {
      throw new Error('PostgreSQL read verification failed');
    }

    const updated = await prisma.user.update({
      where: { id: smokeId },
      data: { displayName: 'Staging smoke updated' },
      select: { displayName: true },
    });
    if (updated.displayName !== 'Staging smoke updated') {
      throw new Error('PostgreSQL update verification failed');
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      const transactionUser = await tx.user.create({
        data: {
          id: transactionUserId,
          username: `staging-transaction-${smokeId}`,
          displayName: 'Transaction smoke',
          authProvider: 'staging-smoke-transaction',
          authProviderId: transactionUserId,
          isGuest: true,
        },
        select: { id: true },
      });
      const updatedTransactionUser = await tx.user.update({
        where: { id: transactionUserId },
        data: { displayName: 'Transaction smoke updated' },
        select: { id: true, displayName: true },
      });
      await tx.user.delete({ where: { id: transactionUserId } });
      return { transactionUser, updatedTransactionUser };
    });
    if (
      transactionResult.transactionUser.id !== transactionUserId ||
      transactionResult.updatedTransactionUser.displayName !==
        'Transaction smoke updated'
    ) {
      throw new Error('PostgreSQL transaction verification failed');
    }

    await redis.connect();
    await redis.set(redisKey, 'created', 'EX', 60);
    if ((await redis.get(redisKey)) !== 'created') {
      throw new Error('Redis create/read verification failed');
    }
    await redis.set(redisKey, 'updated', 'KEEPTTL');
    if ((await redis.get(redisKey)) !== 'updated') {
      throw new Error('Redis update verification failed');
    }
    const ttl = await redis.ttl(redisKey);
    if (ttl <= 0) throw new Error('Redis TTL verification failed');
    if (
      (await redis.del(redisKey)) !== 1 ||
      (await redis.exists(redisKey)) !== 0
    ) {
      throw new Error('Redis cleanup verification failed');
    }

    const deleted = await prisma.user.delete({
      where: { id: smokeId },
      select: { id: true },
    });
    if (deleted.id !== created.id) {
      throw new Error('PostgreSQL cleanup verification failed');
    }

    console.log(
      JSON.stringify({
        status: 'PASS',
        postgresql: 'create-read-update-delete',
        redis: 'set-get-update-ttl-delete',
      }),
    );
  } finally {
    await redis.del(redisKey).catch(() => undefined);
    await redis.quit().catch(() => redis.disconnect());
    await prisma.user.delete({ where: { id: smokeId } }).catch(() => undefined);
    await prisma.user
      .delete({ where: { id: transactionUserId } })
      .catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
