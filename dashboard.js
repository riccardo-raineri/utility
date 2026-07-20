/**
 * =====================================================================
 * DASHBOARD.JS — Interactive Engine (Vanilla JS)
 * =====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inizializza Icone Lucide
    if (window.lucide) {
        lucide.createIcons();
    }

    // Inizializza i moduli
    initParticles();
    initSpotlight();
    init3DTilt();
    initSearchAndFilters();
    updateHeaderStats();
});

/* =========================================================
   1. PARTICELLE DI SFONDO DINAMICHE
   ========================================================= */
function initParticles() {
    const container = document.getElementById('particlesContainer');
    if (!container) return;

    const particleCount = 25;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        const size = Math.random() * 3 + 1;
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
   2. AMBIENT SPOTLIGHT (CURSOR TRACKER)
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
   3. TILT 3D PARALLAX SU HOVER CARD (Apple Vision Pro Style)
   ========================================================= */
function init3DTilt() {
    const cards = document.querySelectorAll('.tool-card:not(.disabled)');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Calcola coordinata relativa per il glow
            card.style.setProperty('--card-mouse-x', `${x}px`);
            card.style.setProperty('--card-mouse-y', `${y}px`);

            // Calcolo inclinazione 3D
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -8; // max -8deg
            const rotateY = ((x - centerX) / centerX) * 8;  // max 8deg

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        });
    });
}

/* =========================================================
   4. RICERCA E FILTRI
   ========================================================= */
function initSearchAndFilters() {
    const searchInput = document.getElementById('searchInput');
    const filterPills = document.querySelectorAll('.filter-pill');
    const cards = document.querySelectorAll('.tool-card');
    const noResults = document.getElementById('noResults');

    let activeCategory = 'tutti';
    let searchQuery = '';

    // Filtraggio dinamico
    function filterGrid() {
        let visibleCount = 0;

        cards.forEach((card, index) => {
            const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
            const desc = card.querySelector('.card-desc')?.textContent.toLowerCase() || '';
            const category = card.dataset.category || '';

            const matchesCategory = (activeCategory === 'tutti') || (category === activeCategory);
            const matchesSearch = title.includes(searchQuery) || desc.includes(searchQuery);

            if (matchesCategory && matchesSearch) {
                card.style.display = 'block';
                // Staggered Fade In Animation
                card.style.opacity = '0';
                card.style.transform = 'translateY(15px)';
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, visibleCount * 40);
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        // Mostra Empty State se zero risultati
        if (noResults) {
            noResults.style.display = visibleCount === 0 ? 'block' : 'none';
        }
    }

    // Listener Input
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            filterGrid();
        });
    }

    // Listener Filtri Categoria
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            activeCategory = pill.dataset.filter;
            filterGrid();
        });
    });

    // Scorciatoia da tastiera Tastiera "/" per il focus rapido sulla ricerca
    document.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement.tagName;
        if (e.key === '/' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
            e.preventDefault();
            if (searchInput) searchInput.focus();
        }
    });
}

/* =========================================================
   5. AGGIORNAMENTO STATISTICHE HEADER
   ========================================================= */
function updateHeaderStats() {
    const cards = document.querySelectorAll('.tool-card');
    const statTools = document.getElementById('statTools');
    const statCategories = document.getElementById('statCategories');

    if (statTools) {
        statTools.textContent = cards.length;
    }

    if (statCategories) {
        const categories = new Set();
        cards.forEach(card => {
            if (card.dataset.category) {
                categories.add(card.dataset.category);
            }
        });
        statCategories.textContent = categories.size;
    }
}