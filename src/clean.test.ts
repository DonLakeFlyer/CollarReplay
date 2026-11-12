import { describe, expect, it } from 'vitest';
import { cleanFixes, type CleanOptions, type CleanResult } from './clean';
import type { Fix } from './collar';

const HOUR = 3_600_000;
const KM_PER_DEG_LAT = 111.195;
const options: CleanOptions = { maxSpeedKmh: 6, outlierKm: 100 };

// Fix `km` north of a fixed origin, `hours` after t=0.
const at = (hours: number, km: number): Fix => ({ time: hours * HOUR, lat: -19 + km / KM_PER_DEG_LAT, lon: 27 });

const flags = (result: CleanResult) => result.flagged.map((f) => [f.time / HOUR, f.reason]);

describe('cleanFixes', () => {
    it('keeps the first of repeated timestamps', () => {
        const result = cleanFixes([at(0, 0), at(1, 0.1), at(1, 0.1), at(2, 0.2)], options);
        expect(result.kept.map((f) => f.time / HOUR)).toEqual([0, 1, 2]);
        expect(flags(result)).toEqual([[1, 'duplicate']]);
    });

    it.each([
        // Like the pre-deployment fix recorded in Cape Town in Umkhonto.csv.
        ['one stray fix', [at(0, 0), at(1, 500), at(2, 0.1), at(3, 0.2)], [[1, 'far-from-home']], 3],
        // The median falls between them, so the remaining rules run on no fixes at all.
        ['two fixes far apart (nothing left)', [at(0, 0), at(1, 1000)], [[0, 'far-from-home'], [1, 'far-from-home']], 0],
    ])('flags fixes far from the median position: %s', (_, track, expected, keptCount) => {
        const result = cleanFixes(track, options);
        expect(flags(result)).toEqual(expected);
        expect(result.kept).toHaveLength(keptCount);
    });

    it.each([
        ['an out-and-back jump is a GPS spike', [at(0, 0), at(2, 30), at(4, 0)], [[2, 'spike']]],
        ['a sustained fast run is a vehicle', [at(0, 0), at(2, 20), at(4, 40), at(6, 60), at(8, 60.5)], [[2, 'vehicle'], [4, 'vehicle']]],
        ['a single fast step flags nothing (no way to tell which end is wrong)', [at(0, 0), at(2, 20), at(4, 20.5)], []],
        // Denning season: hunting trips out from the den and back at ~2 km/h are real behaviour.
        ['a hunting excursion from the den is kept', [at(0, 0), at(3, 6), at(6, 0)], []],
        ['GPS jitter between fixes minutes apart is kept', [at(0, 0), at(0.1, 0.3), at(0.2, 0)], []],
        // PR #2 review: a spike's out and back steps alone must not look like a pre-deployment drive.
        [
            'a GPS spike after a still first day only loses the spike',
            [at(0, 0), at(6, 0.1), at(12, 0), at(18, 0.2), at(24, 0.1), at(30, 0), at(32, 30), at(34, 0.1), at(40, 0.2)],
            [[32, 'spike']],
        ],
    ])('%s', (_, track, expected) => {
        expect(flags(cleanFixes(track, options))).toEqual(expected);
    });

    // Umkhonto.csv: still for a week, then days of vehicle travel, then a dog.
    it.each([
        [
            'the drive starts the same day as the last shelf fix',
            [0, 6, 12, 18, 24, 36, 48, 74].map((h) => at(h, 0)),
            [at(76, 20), at(78, 20.5), at(80, 40)],
            6,
        ],
        // PR #2 review: the last shelf fix and the departure fall on different UTC days.
        [
            'the drive starts after midnight following the last shelf fix',
            [0, 6, 12, 18, 24, 36, 46].map((h) => at(h, 0)),
            [at(48, 20), at(50, 20.5), at(52, 40)],
            6,
        ],
    ])('flags the start of the record before the collar was fitted when %s', (_, shelf, firstDrive, fittedDay) => {
        const parked = [at(100, 40.5), at(110, 40.6)];
        const secondDrive = [at(122, 41), at(124, 61), at(126, 61.5), at(128, 81)];
        const dog = [at(150, 82), at(160, 83), at(170, 82.5)];
        const track = [...shelf, ...firstDrive, ...parked, ...secondDrive, ...dog];
        const fitted = fittedDay * 24 * HOUR;
        expect(flags(cleanFixes(track, options))).toEqual(
            track.filter((f) => f.time < fitted).map((f) => [f.time / HOUR, 'before-deployment']),
        );
    });

    it('does not treat a fast day as pre-deployment once the dog has been moving', () => {
        const track = [at(0, 0), at(6, 3), at(12, 1), at(18, 4), at(26, 4), at(28, 24), at(30, 24.5), at(32, 44), at(40, 45), at(46, 46)];
        expect(flags(cleanFixes(track, options))).toEqual([]);
    });
});
