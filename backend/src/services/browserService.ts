import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

export async function getSessionCookies(url: string, proxy?: string) {
  const args = ['--no-sandbox', '--disable-setuid-sandbox'];
  if (proxy) args.push(`--proxy-server=${proxy}`);

  const browser = await puppeteer.launch({ headless: true, args });
  const page = await browser.newPage();

  const defaultUA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

  await page.setUserAgent(defaultUA);
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  // JS 로드 지연 대비
  await new Promise(resolve => setTimeout(resolve, 1000));

  const userAgent = await page.evaluate(() => {
    // @ts-ignore
    return navigator.userAgent || '';
  });
  const cookies = await page.cookies();

  await browser.close();

  const cookieStr = cookies
    .map(c =>
      [
        c.domain,
        'TRUE',
        c.path,
        c.secure ? 'TRUE' : 'FALSE',
        Math.floor((c.expires && c.expires > 0 ? c.expires : Math.floor(Date.now() / 1000 + 3600))),
        c.name,
        c.value
      ].join('\t')
    )
    .join('\n');

  const cookiePath = path.join('/tmp', `hqmx_cookies_${Date.now()}.txt`);
  await fs.writeFile(cookiePath, cookieStr, 'utf8');

  return { cookiePath, userAgent: userAgent || defaultUA };
}
