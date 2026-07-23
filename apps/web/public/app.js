const content = document.querySelector('#content');
const template = document.querySelector('#media-page');
const nav = [...document.querySelectorAll('nav a')];
const state = { movies: [], tv: [] };

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const badge = (text, tone = '') => `<span class="badge ${tone}">${escapeHtml(text)}</span>`;

function movieCard(item) {
  return `<article class="card"><div class="poster"><img src="${escapeHtml(item.artwork.url)}" alt=""><div class="poster-badges">${badge(item.monitoring === 'all' ? 'Monitored' : 'Future', 'green')}${badge(item.state)}</div></div><div class="card-body"><h2>${escapeHtml(item.title)}</h2><p>${item.year}${item.collection ? ` · ${escapeHtml(item.collection)}` : ''}</p><div class="quality"><span>${item.hasFile ? '●' : '○'}</span><strong>${escapeHtml(item.quality)}</strong></div><button aria-label="Actions for ${escapeHtml(item.title)}">•••</button></div></article>`;
}

function tvCard(item) {
  const next = item.nextEpisode ? new Date(item.nextEpisode.airDateUtc).toLocaleDateString(undefined, { month:'short', day:'numeric' }) : 'Complete';
  return `<article class="card"><div class="poster"><img src="${escapeHtml(item.artwork.url)}" alt=""><div class="poster-badges">${badge(item.monitoring === 'all' ? 'Monitored' : 'Future', 'green')}${item.missingEpisodes ? badge(`${item.missingEpisodes} missing`) : badge('Complete')}</div></div><div class="card-body"><h2>${escapeHtml(item.title)}</h2><p>${item.year} · ${escapeHtml(item.network)}</p><div class="progress"><span style="width:${Math.round(parseInt(item.episodeProgress) / parseInt(item.episodeProgress.split('/')[1]) * 100)}%"></span></div><div class="detail-row"><span>${escapeHtml(item.seasonProgress)} seasons</span><span>${escapeHtml(item.episodeProgress)} episodes</span></div><div class="next"><small>Next</small><strong>${escapeHtml(next)}</strong></div><button aria-label="Actions for ${escapeHtml(item.title)}">•••</button></div></article>`;
}

async function showMedia(kind) {
  const isMovie = kind === 'movies';
  const node = template.content.cloneNode(true);
  node.querySelector('.eyebrow').textContent = 'YOUR LIBRARY';
  node.querySelector('h1').textContent = isMovie ? 'Movies' : 'TV';
  node.querySelector('.lede').textContent = isMovie ? 'Every story, ready when you are.' : 'Track every season and the episodes ahead.';
  node.querySelector('.add-label').textContent = isMovie ? 'movie' : 'series';
  content.replaceChildren(node);
  try {
    const response = await fetch(isMovie ? '/api/v1/movies?limit=24' : '/api/v1/tv/series?limit=24');
    if (!response.ok) throw new Error('Request failed');
    state[kind] = (await response.json()).items;
    const items = state[kind];
    content.querySelector('.count').textContent = items.length;
    content.querySelector('.monitored').textContent = items.filter((item) => item.monitoring !== 'none').length;
    content.querySelector('.attention').textContent = items.filter((item) => isMovie ? item.state !== 'available' : item.missingEpisodes).length;
    const complete = items.filter((item) => isMovie ? item.hasFile : item.missingEpisodes === 0).length;
    content.querySelector('.coverage').textContent = `${Math.round(complete / Math.max(items.length, 1) * 100)}%`;
    content.querySelector('.grid').innerHTML = items.map(isMovie ? movieCard : tvCard).join('');
  } catch {
    content.querySelector('.grid').innerHTML = '<div class="empty"><h2>Library unavailable</h2><p>VynodeNew could not load this library.</p></div>';
  }
}

function showShell(name) {
  content.innerHTML = `<div class="hero"><div><span class="eyebrow">VYNODENEW</span><h1>${escapeHtml(name)}</h1><p class="lede">This unified workspace is ready for the next milestone.</p></div></div><div class="empty"><h2>${escapeHtml(name)} shell</h2><p>The architectural boundary is established; full workflows arrive in a later milestone.</p></div>`;
}

function route() {
  const key = location.hash.slice(1) || 'dashboard';
  nav.forEach((link) => link.classList.toggle('active', link.hash === `#${key}`));
  if (key === 'movies' || key === 'tv') showMedia(key);
  else showShell(key[0].toUpperCase() + key.slice(1));
}
addEventListener('hashchange', route);
document.querySelector('.menu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
route();
