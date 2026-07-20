/**
 * =====================================================================
 * DASHBOARD.JS — Interactive Engine
 * =====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) {
        lucide.createIcons();
    }

    initParticles();
    initSpotlight();
    initSoft3DTilt();
    initSearchAndFilters();
    initFavorites(); // Inizializza i preferiti salvati
});

/* =========================================================
   1. PARTICELLE DI SFONDO DINAMICHE
   ========================================================= */
function initParticles() {
    const container = document.getElementById('particlesContainer');
    if (!container) return;

    const particleCount = 14;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        const size = Math.random() * 2 + 1;
        const left = Math.random() * 100;
        const duration = Math.random() * 10 + 10;
        const delay = Math.random() * 5;

        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${left}%`;
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${delay}s`;

        container.appendChild(particle);
    }
}

/* =========================================================
   2. AMBIENT SPOTLIGHT
   ========================================================= */
function initSpotlight() {
    let ticking = false;

    window.addEventListener('mousemove', (e) => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const x = (e.clientX / window.innerWidth) * 100;
                const y = (e.clientY / window.innerHeight) * 100;

                document.documentElement.style.setProperty('--mouse-x', `${x}%`);
                document.documentElement.style.setProperty('--mouse-y', `${y}%`);
                ticking = false;
            });
            ticking = true;
        }
    });
}

/* =========================================================
   3. INCLINAZIONE 3D SOFFICE
   ========================================================= */
function initSoft3DTilt() {
    const cards = document.querySelectorAll('.tool-card:not(.disabled)');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            card.style.setProperty('--card-mouse-x', `${x}px`);
            card.style.setProperty('--card-mouse-y', `${y}px`);

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -1.5; 
            const rotateY = ((x - centerX) / centerX) * 1.5;  

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
        });
    });
}

/* =========================================================
   4. GESTIONE PREFERITI (LOCALSTORAGE)
   ========================================================= */
function getFavorites() {
    const favs = localStorage.getItem('toolbox_favorites');
    return favs ? JSON.parse(favs) : [];
}

function toggleFavorite(toolId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    let favs = getFavorites();
    if (favs.includes(toolId)) {
        favs = favs.filter(id => id !== toolId);
    } else {
        favs.push(toolId);
    }

    localStorage.setItem('toolbox_favorites', JSON.stringify(favs));
    initFavorites();
}

function initFavorites() {
    const favs = getFavorites();
    const favSection = document.getElementById('favoritesSection');
    const favGrid = document.getElementById('favoritesGrid');

    // Aggiorna lo stato visivo di tutte le stelle nella griglia principale
    document.querySelectorAll('#toolsGrid .tool-card').forEach(card => {
        const toolId = card.dataset.toolId;
        const favBtn = card.querySelector('.fav-btn');
        if (favBtn) {
            if (favs.includes(toolId)) {
                favBtn.classList.add('is-favorite');
            } else {
                favBtn.classList.remove('is-favorite');
            }
        }
    });

    // Costruisce la sezione dei preferiti in cima
    if (favs.length > 0 && favSection && favGrid) {
        favSection.style.display = 'flex';
        favGrid.innerHTML = '';

        favs.forEach(toolId => {
            const originalCard = document.querySelector(`#toolsGrid .tool-card[data-tool-id="${toolId}"]`);
            if (originalCard) {
                const clone = originalCard.cloneNode(true);
                const clonedBtn = clone.querySelector('.fav-btn');
                if (clonedBtn) {
                    clonedBtn.classList.add('is-favorite');
                    clonedBtn.addEventListener('click', (e) => toggleFavorite(toolId, e));
                }
                favGrid.appendChild(clone);
            }
        });
    } else if (favSection) {
        favSection.style.display = 'none';
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

/* =========================================================
   5. RICERCA E FILTRI
   ========================================================= */
function initSearchAndFilters() {
    const searchInput = document.getElementById('searchInput');
    const filterPills = document.querySelectorAll('.filter-pill');
    const cards = document.querySelectorAll('#toolsGrid .tool-card');
    const noResults = document.getElementById('noResults');

    let activeCategory = 'tutti';
    let searchQuery = '';

    function filterGrid() {
        let visibleCount = 0;

        cards.forEach((card) => {
            const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
            const desc = card.querySelector('.card-desc')?.textContent.toLowerCase() || '';
            const category = card.dataset.category || '';

            const matchesCategory = (activeCategory === 'tutti') || (category === activeCategory);
            const matchesSearch = title.includes(searchQuery) || desc.includes(searchQuery);

            if (matchesCategory && matchesSearch) {
                card.style.display = 'block';
                card.style.opacity = '1';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        if (noResults) {
            noResults.style.display = visibleCount === 0 ? 'block' : 'none';
        }
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            filterGrid();
        });
    }

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            activeCategory = pill.dataset.filter;
            filterGrid();
        });
    });

    document.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement.tagName;
        if (e.key === '/' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
            e.preventDefault();
            if (searchInput) searchInput.focus();
        }
    });
}