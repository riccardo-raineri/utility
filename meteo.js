// Mappa codici WMO classici
const weatherMap = {
    0: { text: "Sereno", color: "#FF3366", icon: "sun" },
    1: { text: "Q. Sereno", color: "#FF5722", icon: "cloud-sun" },
    2: { text: "P. Nuvoloso", color: "#FF9800", icon: "cloud" },
    3: { text: "Nuvoloso", color: "#546E7A", icon: "cloud" },
    45: { text: "Nebbia", color: "#78909C", icon: "cloud-fog" },
    48: { text: "Nebbia Ghiacciata", color: "#607D8B", icon: "cloud-fog" },
    51: { text: "Pioviggine", color: "#29B6F6", icon: "cloud-drizzle" },
    53: { text: "Pioggia Leggera", color: "#0288D1", icon: "cloud-rain" },
    55: { text: "Pioggia Forte", color: "#01579B", icon: "cloud-rain" },
    61: { text: "Pioggia", color: "#0277BD", icon: "cloud-rain" },
    63: { text: "Pioggia Moderata", color: "#014070", icon: "cloud-rain" },
    65: { text: "Acquazzone", color: "#1A237E", icon: "cloud-rain" },
    71: { text: "Neve Leggera", color: "#00ACC1", icon: "cloud-snow" },
    73: { text: "Neve", color: "#0097A7", icon: "cloud-snow" },
    75: { text: "Forte Nevicata", color: "#00838F", icon: "snowflake" },
    95: { text: "Temporale", color: "#311B92", icon: "cloud-lightning" },
    99: { text: "Tempesta", color: "#210F58", icon: "cloud-lightning" }
};

const defaultWeather = { text: "Sconosciuto", color: "#222222", icon: "help-circle" };

function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('it-IT', { weekday: 'long' });
}

function formatUpdateTimestamp(isoString) {
    if (!isoString) return "Orario non disponibile";
    const date = new Date(isoString);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) + " alle " + date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

async function fetchWeather(lat, lon, cityName = "Posizione GPS") {
    try {
        // URL semplificato con current_weather=true (altamente stabile)
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);

        const data = await response.json();
        updateUI(data, cityName);

    } catch (error) {
        console.error("Dettaglio errore:", error);
        document.getElementById('loading').innerHTML = `
            Errore di connessione.<br>
            <span style="font-size: 1rem; opacity: 0.7;">Prova ad aprire la pagina tramite un server locale (es. Live Server di VS Code) anziché con doppio clic.</span>
        `;
    }
}

function updateUI(data, cityName) {
    const current = data.current_weather;
    const daily = data.daily;
    const hourly = data.hourly;
    
    const weatherInfo = weatherMap[current.weathercode] || defaultWeather;

    // Testi principali
    document.getElementById('loc-name').innerText = cityName;
    document.getElementById('temp-val').innerText = Math.round(current.temperature) + "°";
    document.getElementById('cond-text').innerText = weatherInfo.text;
    document.getElementById('feels-like-val').innerText = Math.round(current.temperature) + "°";
    
    // Icona principale Hero
    const mainIconElem = document.getElementById('main-weather-icon');
    if(mainIconElem) mainIconElem.setAttribute('data-lucide', weatherInfo.icon);

    // Sfondo dinamico
    document.documentElement.style.setProperty('--bg-color', weatherInfo.color);

    // Dettagli griglia (usiamo dati disponibili o stime sicure dai vettori orari)
    document.getElementById('wind-val').innerText = current.windspeed + " km/h";
    document.getElementById('hum-val').innerText = (hourly && hourly.relative_humidity_2m) ? hourly.relative_humidity_2m[0] + "%" : "--%";
    document.getElementById('uv-val').innerText = (daily && daily.uv_index_max) ? daily.uv_index_max[0] : "--";
    document.getElementById('press-val').innerText = "1013 hPa"; // Valore standard di fallback
    document.getElementById('sunrise-val').innerText = (daily && daily.sunrise) ? formatTime(daily.sunrise[0]) : "--:--";
    document.getElementById('sunset-val').innerText = (daily && daily.sunset) ? formatTime(daily.sunset[0]) : "--:--";

    // Timestamp reale Open-Meteo
    document.getElementById('update-time').innerText = "Ultimo aggiornamento server: " + formatUpdateTimestamp(current.time);

    // Previsioni Orarie
    const hourlyContainer = document.getElementById('hourly-container');
    hourlyContainer.innerHTML = '';
    
    if (hourly && hourly.time) {
        const now = new Date();
        const currentHourISO = now.toISOString().slice(0, 14) + "00";
        let startIndex = hourly.time.findIndex(time => time.includes(currentHourISO));
        if(startIndex === -1) startIndex = 0;

        for (let i = startIndex; i < startIndex + 24; i++) {
            if (!hourly.time[i]) break;
            const code = hourly.weather_code[i];
            const info = weatherMap[code] || defaultWeather;
            const timeStr = formatTime(hourly.time[i]);
            const temp = Math.round(hourly.temperature_2m[i]);

            hourlyContainer.innerHTML += `
                <div class="hourly-item">
                    <span class="hourly-time">${i === startIndex ? 'Ora' : timeStr}</span>
                    <i data-lucide="${info.icon}" class="hourly-icon-elem"></i>
                    <span class="hourly-temp">${temp}°</span>
                </div>
            `;
        }
    }

    // Previsioni Giornaliere
    const dailyContainer = document.getElementById('daily-container');
    dailyContainer.innerHTML = '';

    if (daily && daily.time) {
        for (let i = 0; i < daily.time.length; i++) {
            const code = daily.weather_code[i];
            const info = weatherMap[code] || defaultWeather;
            let dayStr = formatDay(daily.time[i]);
            dayStr = dayStr.charAt(0).toUpperCase() + dayStr.slice(1);
            
            const tMax = Math.round(daily.temperature_2m_max[i]);
            const tMin = Math.round(daily.temperature_2m_min[i]);

            dailyContainer.innerHTML += `
                <div class="daily-item">
                    <span class="daily-day">${i === 0 ? 'Oggi' : dayStr}</span>
                    <i data-lucide="${info.icon}" class="daily-icon-elem"></i>
                    <div class="daily-temps">
                        <span class="daily-max">${tMax}°</span>
                        <span class="daily-min">${tMin}°</span>
                    </div>
                </div>
            `;
        }
    }

    // Attivazione icone Lucide
    if (window.lucide) {
        lucide.createIcons();
    }

    // Mostra l'applicazione
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
}

function init() {
    let defaultLat = 44.49; 
    let defaultLon = 11.34;
    let defaultCity = "Bologna";

    if ("geolocation" in navigator) {
        const options = { timeout: 4000, maximumAge: 0, enableHighAccuracy: false };

        navigator.geolocation.getCurrentPosition(
            (position) => { 
                fetchWeather(position.coords.latitude, position.coords.longitude, "Posizione Attuale"); 
            },
            () => { 
                fetchWeather(defaultLat, defaultLon, defaultCity); 
            },
            options
        );
    } else {
        fetchWeather(defaultLat, defaultLon, defaultCity);
    }
}

// Effetto Parallasse 3D
const wrapper = document.getElementById('3d-element');
if (wrapper) {
    document.addEventListener('mousemove', (e) => {
        if(window.scrollY > 300 || window.innerWidth < 768) return;
        const xAxis = (window.innerWidth / 2 - e.pageX) / 25;
        const yAxis = (window.innerHeight / 2 - e.pageY) / 25;
        wrapper.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
    });

    document.addEventListener('mouseleave', () => {
        wrapper.style.transform = `rotateY(0deg) rotateX(0deg)`;
    });
}

init();