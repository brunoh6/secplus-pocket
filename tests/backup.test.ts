import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

vi.stubGlobal('__APP_VERSION__', 'test');

const { rateCard, recordAttempt, getAllSrs, getAttempts, saveSettings, getSettings, wipeAll, getActiveDays } = await import('../src/db/repo');
const { exportBackup, importBackup, parseBackup } = await import('../src/db/backup');
const { Rating } = await import('../src/engine/srs');

describe('backup round-trip', () => {
  it('exports, wipes, and restores progress', async () => {
    await rateCard({ id: 'fc-1.1-001', kind: 'flashcard', refId: 'fc-1.1-001', objective: '1.1' }, Rating.Good);
    await recordAttempt({ sessionId: 's1', questionId: 'q-1.4-001', objective: '1.4', domain: 1, mode: 'quiz', selected: [1], correct: false, ms: 5000, at: Date.now() });
    await saveSettings({ newPerDay: 20 });
    const json = JSON.stringify(await exportBackup());

    await wipeAll();
    expect(await getAllSrs()).toHaveLength(0);

    await importBackup(parseBackup(json), 'replace');
    const srs = await getAllSrs();
    expect(srs.map((r) => r.id).sort()).toEqual(['fc-1.1-001', 'mistake:q-1.4-001']);
    expect(await getAttempts()).toHaveLength(1);
    expect((await getSettings()).newPerDay).toBe(20);
    expect((await getActiveDays()).length).toBe(1);

    // Merge the same backup again: no duplicates.
    await importBackup(parseBackup(json), 'merge');
    expect(await getAttempts()).toHaveLength(1);
    expect(await getAllSrs()).toHaveLength(2);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow();
  });
});
