import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/** One Prisma client per Nest process, closed during graceful shutdown. */
@Injectable()
export class PrismaClientManager implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.client = new PrismaClient({
      datasources: {
        db: {
          url:
            config.get<string>('DATABASE_URL') ??
            'postgresql://pocha:pocha@localhost:5432/pocha?schema=public',
        },
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
