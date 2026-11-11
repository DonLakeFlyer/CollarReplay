import 'leaflet/dist/leaflet.css';
import './style.css';
import * as L from 'leaflet';
import { parseCollarCsv, removeOutliers, type Fix, type LatLon } from './collar';
import { minimumConvexPolygon } from './range';
import { positionAt, trailAt } from './replay';

const RANGE_PERCENT = 95;
// Fixes this far from a pack's median position are treated as collar errors or pre-deployment fixes.
const OUTLIER_KM = 100;
const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324', '#000075', '#808000'];

interface PackView {
    name: string;
    color: string;
    fixes: Fix[];
    outliers: number;
    layers: L.LayerGroup;
    trail: L.Polyline;
    marker: L.CircleMarker;
    visible: boolean;
}

function element<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

const fileInput = element<HTMLInputElement>('file-input');
const statusLabel = element<HTMLParagraphElement>('status');
const packList = element<HTMLUListElement>('packs');
const timeline = element<HTMLElement>('timeline');
const playButton = element<HTMLButtonElement>('play');
const slider = element<HTMLInputElement>('time-slider');
const timeLabel = element<HTMLSpanElement>('time-label');
const speedSelect = element<HTMLSelectElement>('speed');
const trailSelect = element<HTMLSelectElement>('trail');
const mapElement = element<HTMLDivElement>('map');

const map = L.map(mapElement).setView([0, 20], 3);
const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
});
const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics' },
);
satellite.addTo(map);
L.control.layers({ Satellite: satellite, Street: street }).addTo(map);
L.control.scale({ position: 'topright' }).addTo(map);

const packs = new Map<string, PackView>();
let currentTime = 0;
let playing = false;
let lastFrame = 0;

const toLatLng = (q: LatLon): L.LatLngTuple => [q.lat, q.lon];

function textElement(tag: string, text: string, className?: string): HTMLElement {
    const el = document.createElement(tag);
    el.textContent = text;
    if (className) {
        el.className = className;
    }
    return el;
}

function formatUtc(time: number): string {
    return new Date(time).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}

function timeBounds(): [number, number] {
    let start = Infinity;
    let end = -Infinity;
    for (const pack of packs.values()) {
        start = Math.min(start, pack.fixes[0]!.time);
        end = Math.max(end, pack.fixes[pack.fixes.length - 1]!.time);
    }
    return [start, end];
}

function addPack(name: string, allFixes: Fix[]) {
    const existing = packs.get(name);
    existing?.layers.remove();
    const color = existing?.color ?? COLORS[packs.size % COLORS.length]!;

    const fixes = removeOutliers(allFixes, OUTLIER_KM);
    const polygon = L.polygon(minimumConvexPolygon(fixes, RANGE_PERCENT).map(toLatLng), {
        color,
        weight: 2,
        fillOpacity: 0.12,
    }).bindTooltip(textElement('span', `${name} range (${RANGE_PERCENT}% MCP)`), { sticky: true });
    const trail = L.polyline([], { color, weight: 3, opacity: 0.9 });
    const marker = L.circleMarker([0, 0], { radius: 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 })
        .bindTooltip(textElement('span', name), { permanent: true, direction: 'right', offset: [8, 0] });
    const layers = L.layerGroup([polygon, trail]);

    packs.set(name, {
        name,
        color,
        fixes,
        outliers: allFixes.length - fixes.length,
        layers,
        trail,
        marker,
        visible: existing?.visible ?? true,
    });
}

function renderPackList() {
    packList.replaceChildren();
    for (const pack of packs.values()) {
        const item = document.createElement('li');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = pack.visible;
        checkbox.addEventListener('change', () => {
            pack.visible = checkbox.checked;
            if (pack.visible) {
                pack.layers.addTo(map);
            } else {
                pack.layers.remove();
            }
        });

        const swatch = textElement('span', '', 'swatch');
        swatch.style.background = pack.color;

        const first = pack.fixes[0]!.time;
        const last = pack.fixes[pack.fixes.length - 1]!.time;
        let details = `${pack.fixes.length} fixes, ${formatUtc(first).slice(0, 10)} – ${formatUtc(last).slice(0, 10)}`;
        if (pack.outliers > 0) {
            details += `, ${pack.outliers} outlying fix${pack.outliers > 1 ? 'es' : ''} ignored`;
        }

        const name = textElement('label', pack.name, 'pack-name');
        name.prepend(checkbox);
        item.append(swatch, name, textElement('span', details, 'pack-details'));
        packList.append(item);
    }
}

function render() {
    const trailMs = Number(trailSelect.value);
    for (const pack of packs.values()) {
        const position = positionAt(pack.fixes, currentTime);
        if (position) {
            pack.marker.setLatLng(toLatLng(position));
            pack.layers.addLayer(pack.marker);
        } else {
            pack.layers.removeLayer(pack.marker);
        }
        pack.trail.setLatLngs(trailMs > 0 ? trailAt(pack.fixes, currentTime, trailMs).map(toLatLng) : []);
    }
    slider.value = String(currentTime);
    timeLabel.textContent = formatUtc(currentTime);
}

function setPlaying(value: boolean) {
    playing = value;
    playButton.textContent = playing ? 'Pause' : 'Play';
    if (playing) {
        lastFrame = performance.now();
        requestAnimationFrame(tick);
    }
}

function tick(now: number) {
    if (!playing) {
        return;
    }
    const [, end] = timeBounds();
    currentTime = Math.min(end, currentTime + ((now - lastFrame) / 1000) * Number(speedSelect.value));
    lastFrame = now;
    render();
    if (currentTime >= end) {
        setPlaying(false);
    } else {
        requestAnimationFrame(tick);
    }
}

async function loadFiles(files: File[]) {
    const errors: string[] = [];
    for (const file of files) {
        const name = file.name.replace(/\.csv$/i, '');
        try {
            const fixes = parseCollarCsv(await file.text());
            if (fixes.length === 0) {
                throw new Error('no valid GPS fixes');
            }
            addPack(name, fixes);
        } catch (e) {
            errors.push(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    statusLabel.textContent = errors.join('\n');
    if (packs.size === 0) {
        return;
    }

    const bounds = L.latLngBounds([]);
    for (const pack of packs.values()) {
        if (pack.visible) {
            pack.layers.addTo(map);
        }
        for (const fix of pack.fixes) {
            bounds.extend(toLatLng(fix));
        }
    }
    map.fitBounds(bounds, { padding: [20, 20] });

    const [start, end] = timeBounds();
    slider.min = String(start);
    slider.max = String(end);
    currentTime = Math.min(Math.max(currentTime, start), end);
    timeline.hidden = false;
    renderPackList();
    render();
}

fileInput.addEventListener('change', () => {
    if (fileInput.files) {
        void loadFiles([...fileInput.files]);
    }
    fileInput.value = '';
});

mapElement.addEventListener('dragover', (e) => {
    e.preventDefault();
    mapElement.classList.add('drop-target');
});
mapElement.addEventListener('dragleave', () => mapElement.classList.remove('drop-target'));
mapElement.addEventListener('drop', (e) => {
    e.preventDefault();
    mapElement.classList.remove('drop-target');
    if (e.dataTransfer) {
        void loadFiles([...e.dataTransfer.files]);
    }
});

playButton.addEventListener('click', () => {
    const [start, end] = timeBounds();
    if (!playing && currentTime >= end) {
        currentTime = start;
    }
    setPlaying(!playing);
});
slider.addEventListener('input', () => {
    currentTime = Number(slider.value);
    render();
});
trailSelect.addEventListener('change', render);
