import { PrismaClient } from '@prisma/client';
import { createDefaultSeason } from '../src/ranked/season.repository';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const defaultSeason = createDefaultSeason();
  const season = {
    ...defaultSeason,
    name:
      process.env.APP_ENV === 'staging' ? 'STAGING SEASON' : defaultSeason.name,
  };
  await prisma.rankedSeason.upsert({
    where: { id: season.id },
    create: {
      id: season.id,
      name: season.name,
      number: season.number,
      startsAt: new Date(season.startsAt),
      rulesetId: 'ranked_standard',
      version: season.rulesetVersion,
      status: season.status,
      placementGames: season.placementGames,
      config: season as object,
    },
    update: { name: season.name },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
