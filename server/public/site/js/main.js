// API Base URL
const API_BASE = '/api';

// State
let currentPage = 0;
const pageSize = 12;

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadDate();
    loadNavigation();
    loadNewsTicker();
    loadAds();

    // Content Loading
    loadFeedArticles(); // Middle
    loadFeaturedHeadlines(); // Left
    loadHotNews(); // Right
    loadTrending(); // Right Widget
});

function toggleMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu.style.display === 'block') {
        mobileMenu.style.display = 'none';
    } else {
        mobileMenu.style.display = 'block';
    }
}

// Theme
function initTheme() {
    const toggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    toggle.textContent = savedTheme === 'dark' ? 'Light Mode' : 'Dark Mode';

    toggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        toggle.textContent = newTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
    });
}

// Date
function loadDate() {
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('dateDisplay').textContent = new Date().toLocaleDateString('ne-NP', dateOptions);
}

// Navigation
async function loadNavigation() {
    try {
        const response = await fetch(`${API_BASE}/navigation`);
        const data = await response.json();

        const nav = document.getElementById('dynamicNav');
        const footerNav = document.getElementById('footerNav');
        const mobileNav = document.getElementById('mobileNavList');

        const createLink = (item) => `<li><a href="${item.url}">${item.label}</a></li>`;

        const html = data.items.map(createLink).join('');
        const homeLink = `<li><a href="/">Home</a></li>`;

        nav.innerHTML = homeLink + html;
        footerNav.innerHTML = html;
        mobileNav.innerHTML = homeLink + html;

    } catch (e) {
        console.error('Nav error', e);
    }
}

// Ticker
async function loadNewsTicker() {
    try {
        const response = await fetch(`${API_BASE}/settings/public`);
        const data = await response.json();

        const tickerEnabledSetting = data.settings?.find(s => s.key === 'ticker_enabled');
        const tickerEnabled = tickerEnabledSetting?.value === 'true' || tickerEnabledSetting?.value === true;

        console.log('Ticker enabled:', tickerEnabled, 'Raw value:', tickerEnabledSetting?.value);

        if (!tickerEnabled) {
            document.getElementById('newsTicker').style.display = 'none';
            return;
        }

        // Show ticker
        document.getElementById('newsTicker').style.display = 'block';

        const tickerText = data.settings?.find(s => s.key === 'ticker_text')?.value;
        let items = [];
        if (tickerText && tickerText.trim()) {
            items = tickerText.split('|').map(item => item.trim()).filter(item => item);
        } else {
            // Fallback to latest articles
            const artRes = await fetch(`${API_BASE}/articles?limit=5`);
            const artData = await artRes.json();
            items = artData.articles.map(a => a.headline);
        }

        if (items.length > 0) {
            const html = items.map(item => `<span class="ticker-item">${item}</span>`).join('');
            document.getElementById('tickerItems').innerHTML = html + html;
        }

    } catch (e) {
        console.error('Ticker error:', e);
    }
}

// Ads
async function loadAds() {
    try {
        const response = await fetch(`${API_BASE}/ads`);
        const data = await response.json();

        const placements = {
            'header': 'ad_header',
            'content_top': 'ad_left', // Reuse for left
            'content_bottom': 'ad_right' // Reuse for right
        };

        data.ads.forEach(ad => {
            // Logic to place ads... simplified for now
            if (ad.placement === 'header') {
                document.getElementById('ad_header').innerHTML = `<a href="${ad.link_url}"><img src="${ad.image_url}"></a>`;
            }
        });

    } catch (e) { console.error('Ads error', e); }
}

// Load Middle Feed (Social Style)
async function loadFeedArticles() {
    try {
        const response = await fetch(`${API_BASE}/articles?limit=${pageSize}&offset=${currentPage * pageSize}`);
        const data = await response.json();
        const container = document.getElementById('styles-social-feed');

        const html = data.articles.map(article => `
            <article class="feed-card">
                <!-- Image at Top -->
                ${article.featured_image_url ?
                `<img src="${article.featured_image_url}" alt="${article.headline}" loading="lazy">` :
                ''}
                
                <div class="feed-content">
                    <!-- Title -->
                    <h2 class="feed-title">
                        <a href="/article.html?slug=${article.slug}">${article.headline}</a>
                    </h2>
                    
                    <!-- Meta -->
                    <div class="feed-meta">
                        ${new Date(article.published_at).toLocaleDateString()} • ${article.author_name || 'Admin'}
                    </div>
                    
                    <!-- Summary Below Title/Image -->
                    <div class="feed-summary">
                        ${article.summary || article.body.substring(0, 150) + '...'}
                    </div>
                </div>
                
                <!-- Action Link -->
                <div class="feed-action">
                    <a href="/article.html?slug=${article.slug}" class="read-more-btn">Read Full Article &rarr;</a>
                </div>
            </article>
        `).join('');

        if (currentPage === 0) container.innerHTML = html;
        else container.insertAdjacentHTML('beforeend', html);

    } catch (e) { console.error(e); }
}

document.getElementById('loadMore').addEventListener('click', () => {
    currentPage++;
    loadFeedArticles();
});

// Load Left Headlines (Featured)
async function loadFeaturedHeadlines() {
    try {
        const response = await fetch(`${API_BASE}/articles?featured=true&limit=10`);
        const data = await response.json();
        const container = document.getElementById('leftHeadlines');

        container.innerHTML = data.articles.map(article => `
            <div class="headline-item">
                <a href="/article.html?slug=${article.slug}">${article.headline}</a>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

// Load Right Hot News (Bullets)
async function loadHotNews() {
    try {
        const response = await fetch(`${API_BASE}/articles?breaking=true&limit=10`);
        const data = await response.json();
        const container = document.getElementById('hotNewsList');

        container.innerHTML = data.articles.map(article => `
            <li>
                <a href="/article.html?slug=${article.slug}">${article.headline}</a>
            </li>
        `).join('');
    } catch (e) { console.error(e); }
}

// Trending
function loadTrending() {
    // Placeholder
    document.getElementById('trendingList').innerHTML = '<p>Top stories trending now...</p>';
}
