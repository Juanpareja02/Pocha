import { describe, expect, it } from 'vitest';
import { SeasonService } from './season.service';
import {
  createDefaultSeason,
  InMemorySeasonRepository,
} from './season.repository';

describe('SeasonService', () => {
  it('keeps one active season and exposes a deterministic soft reset', () => {
    const repository = new InMemorySeasonRepository();
    const service = new SeasonService(repository);
    const current = service.requireActive();
    expect(current.status).toBe('ACTIVE');
    expect(service.softResetRating(1400)).toBe(1300);
    expect(service.softResetRating(800)).toBe(850);
  });

  it('activates one season and finishes the previous active season', () => {
    const repository = new InMemorySeasonRepository();
    repository.save({
      ...createDefaultSeason(),
      id: 'season_2',
      name: 'Temporada 2',
      number: 2,
      status: 'UPCOMING',
    });
    const service = new SeasonService(repository);
    expect(service.activate('season_2').id).toBe('season_2');
    expect(repository.findById('season_1')?.status).toBe('FINISHED');
    expect(service.active()?.id).toBe('season_2');
  });

  it('fails closed when there is no active season', () => {
    const repository = new InMemorySeasonRepository();
    const current = repository.findById('season_1')!;
    repository.save({ ...current, status: 'FINISHED' });
    const service = new SeasonService(repository);
    expect(() => service.requireActive()).toThrow('No ranked season is active');
  });
});
