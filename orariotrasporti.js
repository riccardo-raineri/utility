// orariotrasporti - Logica principale, Geolocalizzazione e Mappa

let map;
let userMarker;
let vehicleMarkers = [];

document.addEventListener("DOMContentLoaded", () => {
    initMap(44.4949, 11.3426); // Coordinate iniziali di fallback
    getUserLocation();
});

function initMap(lat, lng) {
    if (map) {
        map.setView([lat, lng], 14);
        return;
    }

    map = L.map('map', {
        zoomControl: false
    }).setView([lat, lng], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO',
        maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
}

function getUserLocation() {
    const statusEl = document.getElementById('location-status');
    
    if (!navigator.geolocation) {
        statusEl.innerText = "Geolocalizzazione non supportata";
        loadTransportData(44.4949, 11.3426, "Zona Centrale");
        return;
    }

    statusEl.innerText = "Rilevamento posizione GPS in corso...";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            statusEl.innerText = `Posizione attiva (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
            
            initMap(lat, lng);
            
            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.circleMarker([lat, lng], {
                radius: 8,
                color: '#10b981',
                fillColor: '#10b981',
                fillOpacity: 0.9,
                weight: 2
            }).addTo(map).bindPopup("<b>La tua posizione attuale</b>").openPopup();

            loadTransportData(lat, lng, "Fermate & Stazione nelle vicinanze");
        },
        (error) => {
            console.warn("Errore geolocalizzazione:", error.message);
            statusEl.innerText = "GPS non disponibile. Uso area predefinita.";
            loadTransportData(44.4949, 11.3426, "Area Urbana Principale");
        },
        { timeout: 10000, maximumAge: 60000 }
    );
}

function loadTransportData(lat, lng, locationLabel) {
    document.querySelector('.bus-stop-name').innerText = `Fermata: ${locationLabel}`;
    document.querySelector('.train-station-name').innerText = `Stazione: ${locationLabel}`;

    // Simulazione aggiornamento dati in tempo reale
    setTimeout(() => {
        renderBusData();
        renderTrainData();
        renderMapVehicles(lat, lng);
    }, 400);
}

function renderBusData() {
    const tbody = document.getElementById('bus-table-body');
    
    // Dati bus (Palette: Blu, Rosso, Bianco/Nero)
    const buses = [
        { line: "BUS 25", dest: "Centro Storico / Dozza", time: "12:32", status: "In orario", type: "ok" },
        { line: "BUS 14", dest: "San Lazzaro", time: "12:36", status: "+4 min", type: "delay" },
        { line: "FILO 13", dest: "Borgo Panigale", time: "12:41", status: "In orario", type: "ok" },
        { line: "BUS 27", dest: "Corticella", time: "12:45", status: "+8 min", type: "heavy-delay" }
    ];

    tbody.innerHTML = buses.map(bus => {
        let badgeStyle = "text-emerald-400 bg-emerald-950/60 border-emerald-900";
        if (bus.type === "delay") badgeStyle = "text-amber-400 bg-amber-950/60 border-amber-900";
        if (bus.type === "heavy-delay") badgeStyle = "text-rose-400 bg-rose-950/60 border-rose-900 font-bold";

        return `
            <tr class="hover:bg-blue-950/30 transition-colors">
                <td class="py-3 px-3 font-bold text-blue-400">${bus.line}</td>
                <td class="py-3 px-3 text-slate-200">${bus.dest}</td>
                <td class="py-3 px-3 text-slate-300">${bus.time}</td>
                <td class="py-3 px-3 text-right">
                    <span class="px-2 py-0.5 text-xs rounded border ${badgeStyle}">${bus.status}</span>
                </td>
            </tr>
        `;
    }).join('');
}

function renderTrainData() {
    const tbody = document.getElementById('train-table-body');
    
    // Dati treni tabellone stazione (Palette: Rosso, Verde, Bianco/Nero)
    const trains = [
        { code: "RV 2282", dest: "VENEZIA S.L.", time: "12:38", bin: "4", info: "REGOLARE", type: "ok" },
        { code: "FR 9514", dest: "ROMA TERMINI - MILANO", time: "12:45", bin: "7", info: "+10 min", type: "delay" },
        { code: "REG 6520", dest: "RIMINI - ANCONA", time: "12:52", bin: "2", info: "REGOLARE", type: "ok" },
        { code: "FA 8511", dest: "FIRENZE S.M.N. - BOLZANO", time: "13:00", bin: "5", info: "+22 min", type: "heavy-delay" }
    ];

    tbody.innerHTML = trains.map(train => {
        let infoStyle = "text-emerald-400 bg-emerald-950/50 border-emerald-900/60";
        if (train.type === "delay") infoStyle = "text-amber-400 bg-amber-950/50 border-amber-900/60";
        if (train.type === "heavy-delay") infoStyle = "text-red-400 bg-red-950/60 border-red-900/60 font-bold animate-pulse";

        return `
            <tr class="hover:bg-zinc-900 transition-colors border-b border-zinc-900/80">
                <td class="py-3 px-3 font-bold text-red-500">${train.code}</td>
                <td class="py-3 px-3 text-zinc-100 font-medium">${train.dest}</td>
                <td class="py-3 px-3 text-zinc-300">${train.time}</td>
                <td class="py-3 px-3 font-bold text-amber-300">Binario ${train.bin}</td>
                <td class="py-3 px-3 text-right">
                    <span class="px-2 py-0.5 text-xs rounded border ${infoStyle}">${train.info}</span>
                </td>
            </tr>
        `;
    }).join('');
}

function renderMapVehicles(lat, lng) {
    vehicleMarkers.forEach(m => map.removeLayer(m));
    vehicleMarkers = [];

    const vehicles = [
        { dLat: 0.0025, dLng: 0.002, type: 'bus', name: 'Bus 25 (In movimento)' },
        { dLat: -0.002, dLng: 0.0035, type: 'bus', name: 'Bus 14 (In movimento)' },
        { dLat: 0.0045, dLng: -0.0025, type: 'train', name: 'Treno RV 2282' },
        { dLat: -0.0035, dLng: -0.002, type: 'train', name: 'Treno FR 9514' }
    ];

    vehicles.forEach(veh => {
        const vLat = lat + veh.dLat;
        const vLng = lng + veh.dLng;
        const color = veh.type === 'bus' ? '#3b82f6' : '#ef4444';

        const marker = L.circleMarker([vLat, vLng], {
            radius: 7,
            color: color,
            fillColor: color,
            fillOpacity: 0.9,
            weight: 2
        }).addTo(map).bindPopup(`<b>${veh.name}</b>`);

        vehicleMarkers.push(marker);
    });
}