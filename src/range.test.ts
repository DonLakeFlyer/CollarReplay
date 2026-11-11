import { describe, expect, it } from 'vitest';
import { convexHull, minimumConvexPolygon } from './range';

const p = (lon: number, lat: number) => ({ lat, lon });

function sameSet(a: { lat: number; lon: number }[], b: { lat: number; lon: number }[]) {
    const key = (q: { lat: number; lon: number }) => `${q.lon},${q.lat}`;
    expect(a.map(key).sort()).toEqual(b.map(key).sort());
}

describe('convexHull', () => {
    it('keeps only the outer points', () => {
        const square = [p(0, 0), p(1, 0), p(1, 1), p(0, 1)];
        sameSet(convexHull([...square, p(0.5, 0.5), p(0.5, 0)]), square);
    });

    it('returns fewer than three distinct points unchanged', () => {
        sameSet(convexHull([p(0, 0), p(1, 1), p(1, 1)]), [p(0, 0), p(1, 1)]);
    });
});

describe('minimumConvexPolygon', () => {
    const square = [p(0, 0), p(0.1, 0), p(0.1, 0.1), p(0, 0.1)];
    const far = p(1, 1);

    it('at 100% is the hull of every fix', () => {
        sameSet(minimumConvexPolygon([...square, far], 100), convexHull([...square, far]));
    });

    it('drops the fixes farthest from the centroid', () => {
        sameSet(minimumConvexPolygon([...square, far], 80), square);
    });
});
