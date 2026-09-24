import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getAllPublishers,
    getFilteredGames,
    getGameById,
    getGamesByCategory,
    getGamesByPublisher,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilterableGames(db: Database): Promise<void> {
    const [strategy] = await db.insert(categories).values({ name: 'Strategy', description: 'cat' }).returning({ id: categories.id });
    const [puzzle] = await db.insert(categories).values({ name: 'Puzzle', description: 'cat' }).returning({ id: categories.id });
    const [alpha] = await db.insert(publishers).values({ name: 'Alpha Games', description: 'pub' }).returning({ id: publishers.id });
    const [beta] = await db.insert(publishers).values({ name: 'Beta Games', description: 'pub' }).returning({ id: publishers.id });

    await db.insert(games).values([
        { title: 'Alpha Strategy', description: 'A', starRating: 4.1, categoryId: strategy.id, publisherId: alpha.id },
        { title: 'Beta Strategy', description: 'B', starRating: 4.3, categoryId: strategy.id, publisherId: beta.id },
        { title: 'Alpha Puzzle', description: 'C', starRating: 4.5, categoryId: puzzle.id, publisherId: alpha.id },
        { title: 'Beta Puzzle', description: 'D', starRating: 4.7, categoryId: puzzle.id, publisherId: beta.id },
    ]);
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('lists all categories and publishers alphabetically', async () => {
        await seedFilterableGames(db);
        expect(await getAllCategories(db)).toEqual([
            { id: expect.any(Number), name: 'Puzzle' },
            { id: expect.any(Number), name: 'Strategy' },
        ]);
        expect(await getAllPublishers(db)).toEqual([
            { id: expect.any(Number), name: 'Alpha Games' },
            { id: expect.any(Number), name: 'Beta Games' },
        ]);
    });

    it('returns games filtered by category', async () => {
        await seedFilterableGames(db);
        const strategyCategory = (await getAllCategories(db)).find((entry) => entry.name === 'Strategy');
        const results = await getGamesByCategory(db, strategyCategory ? [strategyCategory.id] : []);
        expect(results.map((game) => game.title)).toEqual(['Alpha Strategy', 'Beta Strategy']);
    });

    it('returns games filtered by publisher', async () => {
        await seedFilterableGames(db);
        const alphaPublisher = (await getAllPublishers(db)).find((entry) => entry.name === 'Alpha Games');
        const results = await getGamesByPublisher(db, alphaPublisher?.id ?? null);
        expect(results.map((game) => game.title)).toEqual(['Alpha Puzzle', 'Alpha Strategy']);
    });

    it('combines category and publisher filters', async () => {
        await seedFilterableGames(db);
        const strategyCategory = (await getAllCategories(db)).find((entry) => entry.name === 'Strategy');
        const alphaPublisher = (await getAllPublishers(db)).find((entry) => entry.name === 'Alpha Games');
        const results = await getFilteredGames(db, {
            categoryIds: strategyCategory ? [strategyCategory.id] : [],
            publisherId: alphaPublisher?.id ?? null,
        });
        expect(results.map((game) => game.title)).toEqual(['Alpha Strategy']);
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
