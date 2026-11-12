export interface LatLon {
    lat: number;
    lon: number;
}

export interface Fix extends LatLon {
    /** UTC milliseconds since epoch. */
    time: number;
}

export interface Pack {
    name: string;
    fixes: Fix[];
}

function parseUtc(text: string): number {
    return Date.parse(text.trim().replace(' ', 'T') + 'Z');
}

export function parseCollarCsv(text: string): Fix[] {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '' && !line.startsWith('sep='));
    const header = (lines.shift() ?? '').split(',').map((h) => h.trim());
    const timeCol = header.indexOf('UTC Timestamp');
    const latCol = header.indexOf('Latitude');
    const lonCol = header.indexOf('Longitude');
    if (timeCol < 0 || latCol < 0 || lonCol < 0) {
        throw new Error('Expected "UTC Timestamp", "Latitude" and "Longitude" columns');
    }

    const fixes: Fix[] = [];
    for (const line of lines) {
        const cells = line.split(',');
        const time = parseUtc(cells[timeCol] ?? '');
        const lat = Number.parseFloat(cells[latCol] ?? '');
        const lon = Number.parseFloat(cells[lonCol] ?? '');
        if (!Number.isFinite(time) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
            continue;
        }
        if (lat === 0 && lon === 0) {
            continue;
        }
        fixes.push({ time, lat, lon });
    }
    return fixes.sort((a, b) => a.time - b.time);
}

export function distanceKm(a: LatLon, b: LatLon): number {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}
