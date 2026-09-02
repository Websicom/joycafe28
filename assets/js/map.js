export function initMap() {
  const card = document.querySelector('#map-card');
  const button = document.querySelector('#show-map');
  if (!card || !button) return;
  button.addEventListener('click', () => {
    const lat = Number(card.dataset.lat);
    const lon = Number(card.dataset.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const deltaLon = 0.0065;
    const deltaLat = 0.0034;
    const bbox = [lon - deltaLon, lat - deltaLat, lon + deltaLon, lat + deltaLat].join('%2C');
    const iframe = document.createElement('iframe');
    iframe.title = 'Map showing Joy Cafe at 28 Station Road, Melbourn';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
    card.prepend(iframe);
    card.classList.add('is-loaded');
  }, { once: true });
}
