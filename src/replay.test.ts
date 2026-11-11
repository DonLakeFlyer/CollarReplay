import { describe, expect, it } from 'vitest';
import { positionAt, trailAt } from './replay';

const fixes = [
    { time: 0, lat: 0, lon: 0 },
    { time: 10, lat: 1, lon: 2 },
    { time: 20, lat: 3, lon: 2 },
];

describe('positionAt', () => {
    it.each([-1, 21])('is null outside the tracked period (t=%d)', (t) => {
        expect(positionAt(fixes, t)).toBeNull();
    });

    it.each([
        [0, { lat: 0, lon: 0 }],
        [10, { lat: 1, lon: 2 }],
        [20, { lat: 3, lon: 2 }],
        [5, { lat: 0.5, lon: 1 }],
        [15, { lat: 2, lon: 2 }],
    ])('at t=%d is the fix or the linear interpolation between fixes', (t, expected) => {
        expect(positionAt(fixes, t)).toEqual(expected);
    });
});

describe('trailAt', () => {
    it('is the fixes within the window ending at the current position', () => {
        expect(trailAt(fixes, 15, 10)).toEqual([
            { lat: 1, lon: 2 },
            { lat: 2, lon: 2 },
        ]);
    });

    it('is empty outside the tracked period', () => {
        expect(trailAt(fixes, 30, 100)).toEqual([]);
    });
});
