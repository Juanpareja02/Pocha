-- Initial PostgreSQL schema for La Pocha.
-- Apply with `npm run prisma:migrate:deploy`; never use db push in production.
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT 'Invitado',
    "avatarSeed" INTEGER NOT NULL DEFAULT 0,
    "authProvider" TEXT NOT NULL DEFAULT 'development',
    "authProviderId" TEXT,
    "isGuest" BOOLEAN NOT NULL DEFAULT true,
    "avatar" TEXT,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "peakElo" INTEGER NOT NULL DEFAULT 1000,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "podiums" INTEGER NOT NULL DEFAULT 0,
    "averagePosition" DOUBLE PRECISION,
    "predictionAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "casualGamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "casualWins" INTEGER NOT NULL DEFAULT 0,
    "casualPodiums" INTEGER NOT NULL DEFAULT 0,
    "casualAveragePosition" DOUBLE PRECISION,
    "casualPredictionAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "disconnectRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rankedGamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "rankedWins" INTEGER NOT NULL DEFAULT 0,
    "rankedPodiums" INTEGER NOT NULL DEFAULT 0,
    "rankedAveragePosition" DOUBLE PRECISION,
    "rankedBestElo" INTEGER NOT NULL DEFAULT 1000,
    "rankedPredictionAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rankedAbandons" INTEGER NOT NULL DEFAULT 0,
    "rankedDisconnects" INTEGER NOT NULL DEFAULT 0,
    "rankedTimeouts" INTEGER NOT NULL DEFAULT 0,
    "queuePenaltyUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RankedSeason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "rulesetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "placementGames" INTEGER NOT NULL DEFAULT 10,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RankedSeason_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "roomId" TEXT,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rulesetId" TEXT NOT NULL,
    "rulesetVersion" INTEGER NOT NULL,
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "seasonId" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GamePlayer" (
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "position" INTEGER,
    "score" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GamePlayer_pkey" PRIMARY KEY ("gameId", "userId")
);

CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "eloDelta" INTEGER,
    "oldRating" INTEGER,
    "newRating" INTEGER,
    "rankId" TEXT,
    "previousRankId" TEXT,
    "promoted" BOOLEAN NOT NULL DEFAULT false,
    "demoted" BOOLEAN NOT NULL DEFAULT false,
    "abandoned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RatingHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT,
    "seasonId" TEXT,
    "before" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatingHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchmakingEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "elo" INTEGER NOT NULL,
    "range" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queueType" TEXT NOT NULL DEFAULT 'casual',
    "seasonId" TEXT,
    "rulesetId" TEXT,
    "rulesetVersion" INTEGER,
    "provisional" BOOLEAN NOT NULL DEFAULT false,
    "region" TEXT,
    CONSTRAINT "MatchmakingEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeasonPlayerStats" (
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "peakRating" INTEGER NOT NULL DEFAULT 1000,
    "placementGames" INTEGER NOT NULL DEFAULT 0,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "podiums" INTEGER NOT NULL DEFAULT 0,
    "averagePosition" DOUBLE PRECISION,
    "predictionAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeasonPlayerStats_pkey" PRIMARY KEY ("seasonId", "userId")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_elo_id_idx" ON "User"("elo", "id");
CREATE UNIQUE INDEX "User_authProvider_authProviderId_key" ON "User"("authProvider", "authProviderId");
CREATE UNIQUE INDEX "RankedSeason_number_key" ON "RankedSeason"("number");
CREATE INDEX "Game_roomId_status_createdAt_idx" ON "Game"("roomId", "status", "createdAt");
CREATE INDEX "Game_status_createdAt_idx" ON "Game"("status", "createdAt");
CREATE INDEX "GamePlayer_userId_gameId_idx" ON "GamePlayer"("userId", "gameId");
CREATE UNIQUE INDEX "GamePlayer_gameId_seat_key" ON "GamePlayer"("gameId", "seat");
CREATE INDEX "GameEvent_gameId_version_idx" ON "GameEvent"("gameId", "version");
CREATE INDEX "GameResult_userId_createdAt_idx" ON "GameResult"("userId", "createdAt");
CREATE INDEX "GameResult_gameId_createdAt_idx" ON "GameResult"("gameId", "createdAt");
CREATE UNIQUE INDEX "GameResult_gameId_userId_key" ON "GameResult"("gameId", "userId");
CREATE INDEX "RatingHistory_userId_createdAt_idx" ON "RatingHistory"("userId", "createdAt");
CREATE INDEX "RatingHistory_gameId_createdAt_idx" ON "RatingHistory"("gameId", "createdAt");
CREATE INDEX "RatingHistory_seasonId_createdAt_idx" ON "RatingHistory"("seasonId", "createdAt");
CREATE UNIQUE INDEX "MatchmakingEntry_userId_key" ON "MatchmakingEntry"("userId");
CREATE INDEX "MatchmakingEntry_queueType_seasonId_createdAt_idx" ON "MatchmakingEntry"("queueType", "seasonId", "createdAt");
CREATE INDEX "SeasonPlayerStats_seasonId_rating_userId_idx" ON "SeasonPlayerStats"("seasonId", "rating", "userId");

ALTER TABLE "Game" ADD CONSTRAINT "Game_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "RankedSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RatingHistory" ADD CONSTRAINT "RatingHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonPlayerStats" ADD CONSTRAINT "SeasonPlayerStats_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "RankedSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonPlayerStats" ADD CONSTRAINT "SeasonPlayerStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
