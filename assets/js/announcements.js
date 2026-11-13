export function isActiveDateRange(item, now = new Date()) {
  return now >= new Date(item.startDate) && now <= new Date(item.endDate);
}

export function getActiveAnnouncement(items, now = new Date()) {
  return items.find((item) => item.enabled && isActiveDateRange(item, now));
}

export function initTimedContent(now = new Date()) {
  document.querySelectorAll('[data-start-date][data-end-date]').forEach((element) => {
    element.hidden = !isActiveDateRange({
      startDate: element.dataset.startDate,
      endDate: element.dataset.endDate
    }, now);
  });
}

export async function initAnnouncements() {
  const bar = document.querySelector('#announcement');
  if (!bar) return;
  try {
    const response = await fetch('/data/announcements.json', { cache: 'no-store' });
    if (!response.ok) return;
    const active = getActiveAnnouncement(await response.json());
    if (!active) {
      bar.hidden = true;
      bar.replaceChildren();
      return;
    }
    bar.replaceChildren();
    const message = document.createElement('span');
    message.textContent = active.message;
    bar.append(message);
    if (active.linkText && active.link) {
      const link = document.createElement('a');
      link.textContent = active.linkText;
      link.href = active.link;
      bar.append(link);
    }
    bar.hidden = false;
  } catch {
    bar.hidden = true;
  }
}
