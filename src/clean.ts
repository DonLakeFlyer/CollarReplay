import { distanceKm, type Fix } from './collar';

export type FlagReason = 'duplicate' | 'far-from-home' | 'before-deployment' | 'spike' | 'vehicle';

export interface FlaggedFix extends Fix {
    reason: FlagReason;
}

export interface CleanOptions {
    /** Fastest plausible average speed between fixes; faster steps are suspect. */
    maxSpeedKmh: number;
    /** Fixes further than this from the median position are dropped. */
    outlierKm: number;
}

export interface CleanResult {
    kept: Fix[];
    flagged: FlaggedFix[];
}

// Speeds are averaged over at least this long so GPS jitter between close fixes doesn't look fast.
const MIN_SPEED_INTERVAL_MS = 3_600_000;
const DAY_MS = 86_400_000;
// A collar that stays within this distance of its first fix hasn't been fitted to a dog yet.
const STILL_KM = 1;
// Days of vehicle travel this close together belong to the same pre-deployment period.
const MAX_VEHICLE_DAY_GAP = 3;
// One out-and-back GPS spike can make a single fast day on its own, so a drive needs more than one.
const MIN_VEHICLE_DAYS = 2;

type StepTest = (a: Fix, b: Fix) => boolean;

const dayOf = (time: number) => Math.floor(time / DAY_MS);

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * When the record starts with the collar sitting still for a day or more and then being driven around (two or more
 * days with two or more fast steps), returns the UTC midnight after that driving ended. Otherwise -Infinity.
 */
function deploymentTime(fixes: Fix[], tooFast: StepTest): number {
    const first = fixes[0];
    if (!first) {
        return -Infinity;
    }
    let stillEnd = first.time;
    let leftShelf: Fix | undefined;
    for (const fix of fixes) {
        if (distanceKm(first, fix) > STILL_KM) {
            leftShelf = fix;
            break;
        }
        stillEnd = fix.time;
    }

    const fastSteps = new Map<number, number>();
    for (let i = 1; i < fixes.length; i++) {
        if (tooFast(fixes[i - 1]!, fixes[i]!)) {
            const day = dayOf(fixes[i]!.time);
            fastSteps.set(day, (fastSteps.get(day) ?? 0) + 1);
        }
    }
    const vehicleDays = [...fastSteps].filter(([, count]) => count >= 2).map(([day]) => day).sort((a, b) => a - b);

    let lastDay = vehicleDays[0];
    if (lastDay === undefined || !leftShelf || stillEnd - first.time < DAY_MS || lastDay > dayOf(leftShelf.time)) {
        return -Infinity;
    }
    let driveDays = 0;
    for (const day of vehicleDays) {
        if (day - lastDay > MAX_VEHICLE_DAY_GAP) {
            break;
        }
        lastDay = day;
        driveDays++;
    }
    return driveDays >= MIN_VEHICLE_DAYS ? (lastDay + 1) * DAY_MS : -Infinity;
}

/** Splits time-sorted fixes into plausible fixes and flagged ones, each with the reason it was dropped. */
export function cleanFixes(fixes: Fix[], options: CleanOptions): CleanResult {
    const flagged: FlaggedFix[] = [];
    const flag = (fix: Fix, reason: FlagReason) => flagged.push({ ...fix, reason });

    let kept: Fix[] = [];
    for (const fix of fixes) {
        if (kept.length > 0 && kept[kept.length - 1]!.time === fix.time) {
            flag(fix, 'duplicate');
        } else {
            kept.push(fix);
        }
    }

    if (kept.length > 0) {
        const center = { lat: median(kept.map((f) => f.lat)), lon: median(kept.map((f) => f.lon)) };
        kept = kept.filter((f) => {
            const far = distanceKm(f, center) > options.outlierKm;
            if (far) {
                flag(f, 'far-from-home');
            }
            return !far;
        });
    }

    const tooFast: StepTest = (a, b) =>
        distanceKm(a, b) / (Math.max(b.time - a.time, MIN_SPEED_INTERVAL_MS) / 3_600_000) > options.maxSpeedKmh;

    const fitted = deploymentTime(kept, tooFast);
    kept = kept.filter((f) => {
        const before = f.time < fitted;
        if (before) {
            flag(f, 'before-deployment');
        }
        return !before;
    });

    // A run of two or more fast steps in a row means the fixes inside it are wrong. With exactly two steps
    // that end back near the start it's one bad GPS fix; otherwise the collar was travelling in a vehicle.
    const bad = new Map<number, FlagReason>();
    let runStart = 0;
    for (let i = 0; i < kept.length; i++) {
        const stepIsFast = i + 1 < kept.length && tooFast(kept[i]!, kept[i + 1]!);
        if (stepIsFast) {
            continue;
        }
        const steps = i - runStart;
        if (steps >= 2) {
            const reason = steps === 2 && !tooFast(kept[runStart]!, kept[i]!) ? 'spike' : 'vehicle';
            for (let j = runStart + 1; j < i; j++) {
                bad.set(j, reason);
            }
        }
        runStart = i + 1;
    }
    kept = kept.filter((f, i) => {
        const reason = bad.get(i);
        if (reason) {
            flag(f, reason);
        }
        return !reason;
    });

    flagged.sort((a, b) => a.time - b.time);
    return { kept, flagged };
}
