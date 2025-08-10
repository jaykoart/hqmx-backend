export function getRandomProxy(): string | undefined {
  const raw = process.env.RESIDENTIAL_PROXIES || '';
  const proxies = raw.split(',').map(p => p.trim()).filter(Boolean);
  if (!proxies.length) return undefined;
  return proxies[Math.floor(Math.random() * proxies.length)];
}
