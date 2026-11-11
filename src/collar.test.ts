import { describe, expect, it } from 'vitest';
import { parseCollarCsv, removeOutliers } from './collar';

const header =
    'UTC Timestamp,Latitude,Longitude,GPS Accuracy,Number of SVs,Altitude (metres),Speed (km/h),Heading,' +
    'Battery Voltage,Battery Percentage,Device Temperature,Sensor Temperature,Pressure,Time Underwater,Activity Count';

function csv(...rows: string[]): string {
    return ['sep=,', header, ...rows].join('\r\n') + '\r\n';
}

describe('parseCollarCsv', () => {
    it('reads UTC timestamps and coordinates from the collar export format', () => {
        const fixes = parseCollarCsv(csv('2025-01-01 01:00:30,-18.9199763,27.1079768,35,0,0.0,0.0,0,3.97,96,30.0,0.0,0.0,0,231'));
        expect(fixes).toEqual([{ time: Date.UTC(2025, 0, 1, 1, 0, 30), lat: -18.9199763, lon: 27.1079768 }]);
    });

    it('returns fixes in time order', () => {
        const fixes = parseCollarCsv(
            csv(
                '2025-01-02 00:00:00,-18.2,27.2,35,0,0,0,0,4,100,30,0,0,0,0',
                '2025-01-01 00:00:00,-18.1,27.1,35,0,0,0,0,4,100,30,0,0,0,0',
            ),
        );
        expect(fixes.map((f) => f.lat)).toEqual([-18.1, -18.2]);
    });

    it.each([
        ['missing coordinates', '2025-01-01 00:00:00,,,35,0,0,0,0,4,100,30,0,0,0,0'],
        ['null island', '2025-01-01 00:00:00,0,0,35,0,0,0,0,4,100,30,0,0,0,0'],
        ['bad timestamp', 'not a time,-18.1,27.1,35,0,0,0,0,4,100,30,0,0,0,0'],
    ])('skips rows with %s', (_, row) => {
        expect(parseCollarCsv(csv(row))).toEqual([]);
    });

    it('rejects files without the required columns', () => {
        expect(() => parseCollarCsv('a,b,c\n1,2,3\n')).toThrow(/Latitude/);
    });
});

describe('removeOutliers', () => {
    it('drops fixes far from the median position', () => {
        const home = [
            { time: 1, lat: -18.9, lon: 27.1 },
            { time: 2, lat: -18.95, lon: 27.15 },
            { time: 3, lat: -18.85, lon: 27.05 },
        ];
        // Pre-deployment fix recorded in Cape Town (Umkhonto.csv).
        const capeTown = { time: 0, lat: -33.93, lon: 18.42 };
        expect(removeOutliers([capeTown, ...home], 100)).toEqual(home);
    });
});
