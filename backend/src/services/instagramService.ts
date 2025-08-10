import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { getRandomDelay } from '../utils/security';

interface InstagramSession {
  cookiePath: string;
  userAgent: string;
  csrfToken?: string;
}

// 인스타그램 로그인 및 세션 관리
export async function getInstagramSession(
  username?: string, 
  password?: string, 
  proxy?: string
): Promise<InstagramSession> {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled'
  ];
  
  if (proxy) args.push(`--proxy-server=${proxy}`);

  const browser = await puppeteer.launch({ 
    headless: true, 
    args,
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  
  // 브라우저 자동화 감지 방지
  await page.evaluateOnNewDocument(() => {
    // @ts-ignore
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    // @ts-ignore
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    // @ts-ignore
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });

  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
  await page.setUserAgent(userAgent);

  try {
    // 인스타그램 메인 페이지 접속
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });

    // 자연스러운 지연
    await new Promise(resolve => setTimeout(resolve, getRandomDelay()));

    // 로그인 시도 (자격증명이 제공된 경우)
    if (username && password) {
      await performInstagramLogin(page, username, password);
    }

    // 쿠키 및 세션 정보 추출
    const cookies = await page.cookies();
    const csrfToken = await extractCSRFToken(page);

    await browser.close();

    // 쿠키 파일 생성
    const cookieStr = cookies
      .map(c => [
        c.domain,
        'TRUE',
        c.path,
        c.secure ? 'TRUE' : 'FALSE',
        Math.floor((c.expires && c.expires > 0 ? c.expires : Math.floor(Date.now() / 1000 + 3600))),
        c.name,
        c.value
      ].join('\t'))
      .join('\n');

    const cookiePath = path.join('/tmp', `instagram_cookies_${Date.now()}.txt`);
    await fs.writeFile(cookiePath, cookieStr, 'utf8');

    logger.info('Instagram session obtained successfully');
    
    return { 
      cookiePath, 
      userAgent, 
      csrfToken 
    };

  } catch (error) {
    await browser.close();
    logger.error('Failed to get Instagram session:', error);
    throw error;
  }
}

// 인스타그램 로그인 수행
async function performInstagramLogin(page: any, username: string, password: string): Promise<void> {
  try {
    // 로그인 버튼 클릭
    await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
    await page.click('button[type="submit"]');
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 사용자명 입력
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.type('input[name="username"]', username, { delay: 100 });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 비밀번호 입력
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    await page.type('input[name="password"]', password, { delay: 100 });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 로그인 버튼 클릭
    await page.click('button[type="submit"]');

    // 로그인 완료 대기
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

    logger.info('Instagram login successful');

  } catch (error) {
    logger.error('Instagram login failed:', error);
    throw error;
  }
}

// CSRF 토큰 추출
async function extractCSRFToken(page: any): Promise<string | undefined> {
  try {
    const csrfToken = await page.evaluate(() => {
      // @ts-ignore
      return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    });
    return csrfToken;
  } catch (error) {
    logger.warn('Failed to extract CSRF token:', error);
    return undefined;
  }
}

// 인스타그램 미디어 분석
export async function analyzeInstagramMedia(url: string, session: InstagramSession): Promise<any> {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--disable-dev-shm-usage'
  ];

  const browser = await puppeteer.launch({ headless: true, args });
  const page = await browser.newPage();

  // 세션 쿠키 적용
  const cookies = await fs.readFile(session.cookiePath, 'utf8');
  const cookieLines = cookies.split('\n').filter(line => line.trim());
  
  for (const line of cookieLines) {
    const [domain, , path, secure, expires, name, value] = line.split('\t');
    await page.setCookie({
      domain,
      path,
      secure: secure === 'TRUE',
      expires: parseInt(expires),
      name,
      value
    });
  }

  await page.setUserAgent(session.userAgent);

  try {
    // 자연스러운 지연
    await new Promise(resolve => setTimeout(resolve, getRandomDelay()));

    // 인스타그램 페이지 접속
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 추가 지연 (봇 감지 방지)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 미디어 정보 추출
    const mediaInfo = await page.evaluate(() => {
      // @ts-ignore
      const title = document.querySelector('h1')?.textContent || '';
      // @ts-ignore
      const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
      // @ts-ignore
      const imageUrl = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      
      return {
        title,
        description,
        imageUrl,
        type: 'instagram'
      };
    });

    await browser.close();
    return mediaInfo;

  } catch (error) {
    await browser.close();
    logger.error('Failed to analyze Instagram media:', error);
    throw error;
  }
}
