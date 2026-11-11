import { distanceKm, type LatLon } from './collar';

function cross(o: LatLon, a: LatLon, b: LatLon): number {
    return (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon);
}

/** Andrew's monotone chain; returns the hull counter-clockwise without repeating the first point. */
export function convexHull(points: LatLon[]): LatLon[] {
    const sorted = [...points].sort((a, b) => a.lon - b.lon || a.lat - b.lat);
    const unique = sorted.filter((q, i) => i === 0 || q.lon !== sorted[i - 1]!.lon || q.lat !== sorted[i - 1]!.lat);
    if (unique.length < 3) {
        return unique;
    }

    const half = (pts: LatLon[]) => {
        const chain: LatLon[] = [];
        for (const q of pts) {
            while (chain.length >= 2 && cross(chain[chain.length - 2]!, chain[chain.length - 1]!, q) <= 0) {
                chain.pop();
            }
            chain.push(q);
        }
        chain.pop();
        return chain;
    };
    return [...half(unique), ...half([...unique].reverse())];
}

/** Home-range MCP: hull of the given percentage of fixes closest to their centroid. */
export function minimumConvexPolygon(points: LatLon[], percent: number): LatLon[] {
    if (points.length === 0) {
        return [];
    }
    const centroid = {
        lat: points.reduce((sum, q) => sum + q.lat, 0) / points.length,
        lon: points.reduce((sum, q) => sum + q.lon, 0) / points.length,
    };
    const keep = Math.ceil((points.length * percent) / 100);
    const closest = points
        .map((q) => ({ q, d: distanceKm(q, centroid) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, keep)
        .map(({ q }) => q);
    return convexHull(closest);
}
