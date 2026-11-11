import type { Fix, LatLon } from './collar';

/** Index of the last fix with time <= t, or -1. */
function lastFixAtOrBefore(fixes: Fix[], t: number): number {
    let lo = 0;
    let hi = fixes.length - 1;
    let found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (fixes[mid]!.time <= t) {
            found = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return found;
}

/** Position linearly interpolated between fixes; null outside the tracked period. */
export function positionAt(fixes: Fix[], t: number): LatLon | null {
    const i = lastFixAtOrBefore(fixes, t);
    if (i < 0) {
        return null;
    }
    const a = fixes[i]!;
    if (a.time === t) {
        return { lat: a.lat, lon: a.lon };
    }
    const b = fixes[i + 1];
    if (!b) {
        return null;
    }
    const f = (t - a.time) / (b.time - a.time);
    return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
}

/** Fixes within (t - durationMs, t] followed by the current position. */
export function trailAt(fixes: Fix[], t: number, durationMs: number): LatLon[] {
    const current = positionAt(fixes, t);
    if (!current) {
        return [];
    }
    const trail: LatLon[] = [];
    for (let i = lastFixAtOrBefore(fixes, t); i >= 0 && fixes[i]!.time > t - durationMs; i--) {
        trail.push({ lat: fixes[i]!.lat, lon: fixes[i]!.lon });
    }
    trail.reverse();
    const last = trail[trail.length - 1];
    if (!last || last.lat !== current.lat || last.lon !== current.lon) {
        trail.push(current);
    }
    return trail;
}
