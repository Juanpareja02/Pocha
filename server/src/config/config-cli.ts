import { appConfigFromEnvironment } from './app-config';

const config = appConfigFromEnvironment();
console.log(
  JSON.stringify({
    status: 'ok',
    appEnv: config.appEnv,
    port: config.port,
    authProvider: config.authProvider,
    stores: {
      user: config.userStore,
      game: config.gameStore,
      season: config.seasonStore,
      ranked: config.rankedStore,
      room: config.roomStore,
      sessionLookup: config.sessionLookupStore,
      presence: config.presenceStore,
      casualQueue: config.casualQueueStore,
      rankedQueue: config.rankedQueueStore,
    },
  }),
);
