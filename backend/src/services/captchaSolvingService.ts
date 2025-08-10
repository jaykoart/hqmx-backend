import { logger } from '../utils/logger';
import axios from 'axios';

// CAPTCHA 해결 서비스 설정
interface CaptchaService {
  name: string;
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
}

const CAPTCHA_SERVICES: CaptchaService[] = [
  {
    name: '2captcha',
    apiKey: process.env.TWOCAPTCHA_API_KEY || 'demo_key_1',
    baseUrl: 'https://2captcha.com',
    enabled: true
  },
  {
    name: 'anticaptcha',
    apiKey: process.env.ANTICAPTCHA_API_KEY || 'demo_key_2', 
    baseUrl: 'https://api.anti-captcha.com',
    enabled: true
  },
  {
    name: 'deathbycaptcha',
    apiKey: process.env.DEATHBYCAPTCHA_API_KEY || 'demo_key_3',
    baseUrl: 'https://api.deathbycaptcha.com',
    enabled: true
  }
];

interface CaptchaTask {
  id: string;
  type: 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha' | 'funcaptcha' | 'image';
  sitekey?: string;
  pageurl?: string;
  imageBase64?: string;
  action?: string;
  minScore?: number;
}

interface CaptchaResult {
  success: boolean;
  solution?: string;
  error?: string;
  cost?: number;
  solveTime?: number;
}

// 메인 CAPTCHA 해결 함수
export async function solveCaptcha(task: CaptchaTask): Promise<CaptchaResult> {
  logger.info(`Starting CAPTCHA solving for type: ${task.type}`);
  
  // 사용 가능한 서비스들을 순서대로 시도
  for (const service of CAPTCHA_SERVICES) {
    if (!service.enabled) continue;
    
    try {
      logger.info(`Attempting CAPTCHA solve with: ${service.name}`);
      const result = await solveCaptchaWithService(task, service);
      
      if (result.success) {
        logger.info(`CAPTCHA solved successfully with ${service.name} in ${result.solveTime}ms`);
        return result;
      }
    } catch (error) {
      logger.warn(`CAPTCHA service ${service.name} failed: ${error}`);
    }
  }
  
  return {
    success: false,
    error: 'All CAPTCHA services failed'
  };
}

// 특정 서비스로 CAPTCHA 해결
async function solveCaptchaWithService(task: CaptchaTask, service: CaptchaService): Promise<CaptchaResult> {
  const startTime = Date.now();
  
  switch (service.name) {
    case '2captcha':
      return await solve2Captcha(task, service, startTime);
    case 'anticaptcha':
      return await solveAntiCaptcha(task, service, startTime);
    case 'deathbycaptcha':
      return await solveDeathByCaptcha(task, service, startTime);
    default:
      throw new Error(`Unknown CAPTCHA service: ${service.name}`);
  }
}

// 2Captcha 서비스
async function solve2Captcha(task: CaptchaTask, service: CaptchaService, startTime: number): Promise<CaptchaResult> {
  try {
    // 1단계: CAPTCHA 제출
    const submitData = prepare2CaptchaData(task, service.apiKey);
    const submitResponse = await axios.post(`${service.baseUrl}/in.php`, submitData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    });
    
    if (!submitResponse.data.startsWith('OK|')) {
      throw new Error(`Submit failed: ${submitResponse.data}`);
    }
    
    const captchaId = submitResponse.data.split('|')[1];
    logger.info(`2Captcha task submitted with ID: ${captchaId}`);
    
    // 2단계: 결과 대기 및 조회
    const solution = await poll2CaptchaResult(captchaId, service);
    
    return {
      success: true,
      solution: solution,
      solveTime: Date.now() - startTime,
      cost: getCaptchaCost(task.type, service.name)
    };
  } catch (error) {
    throw new Error(`2Captcha failed: ${error}`);
  }
}

// AntiCaptcha 서비스
async function solveAntiCaptcha(task: CaptchaTask, service: CaptchaService, startTime: number): Promise<CaptchaResult> {
  try {
    // 1단계: 태스크 생성
    const taskData = prepareAntiCaptchaData(task, service.apiKey);
    const createResponse = await axios.post(`${service.baseUrl}/createTask`, taskData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    if (createResponse.data.errorId !== 0) {
      throw new Error(`Task creation failed: ${createResponse.data.errorDescription}`);
    }
    
    const taskId = createResponse.data.taskId;
    logger.info(`AntiCaptcha task created with ID: ${taskId}`);
    
    // 2단계: 결과 대기 및 조회
    const solution = await pollAntiCaptchaResult(taskId, service);
    
    return {
      success: true,
      solution: solution,
      solveTime: Date.now() - startTime,
      cost: getCaptchaCost(task.type, service.name)
    };
  } catch (error) {
    throw new Error(`AntiCaptcha failed: ${error}`);
  }
}

// DeathByCaptcha 서비스
async function solveDeathByCaptcha(task: CaptchaTask, service: CaptchaService, startTime: number): Promise<CaptchaResult> {
  try {
    const taskData = prepareDeathByCaptchaData(task, service.apiKey);
    const response = await axios.post(`${service.baseUrl}/api/captcha`, taskData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 120000 // DeathByCaptcha는 더 오래 걸릴 수 있음
    });
    
    if (response.data.is_correct && response.data.text) {
      return {
        success: true,
        solution: response.data.text,
        solveTime: Date.now() - startTime,
        cost: getCaptchaCost(task.type, service.name)
      };
    }
    
    throw new Error(`DeathByCaptcha failed: ${JSON.stringify(response.data)}`);
  } catch (error) {
    throw new Error(`DeathByCaptcha failed: ${error}`);
  }
}

// 2Captcha 데이터 준비
function prepare2CaptchaData(task: CaptchaTask, apiKey: string): string {
  const params = new URLSearchParams();
  params.append('key', apiKey);
  
  switch (task.type) {
    case 'recaptcha_v2':
      params.append('method', 'userrecaptcha');
      params.append('googlekey', task.sitekey!);
      params.append('pageurl', task.pageurl!);
      break;
    case 'recaptcha_v3':
      params.append('method', 'userrecaptcha');
      params.append('version', 'v3');
      params.append('googlekey', task.sitekey!);
      params.append('pageurl', task.pageurl!);
      params.append('action', task.action || 'verify');
      params.append('min_score', (task.minScore || 0.3).toString());
      break;
    case 'hcaptcha':
      params.append('method', 'hcaptcha');
      params.append('sitekey', task.sitekey!);
      params.append('pageurl', task.pageurl!);
      break;
    case 'image':
      params.append('method', 'base64');
      params.append('body', task.imageBase64!);
      break;
  }
  
  return params.toString();
}

// AntiCaptcha 데이터 준비
function prepareAntiCaptchaData(task: CaptchaTask, apiKey: string): any {
  const data: any = {
    clientKey: apiKey,
    softId: 0
  };
  
  switch (task.type) {
    case 'recaptcha_v2':
      data.task = {
        type: 'NoCaptchaTaskProxyless',
        websiteURL: task.pageurl,
        websiteKey: task.sitekey
      };
      break;
    case 'recaptcha_v3':
      data.task = {
        type: 'RecaptchaV3TaskProxyless',
        websiteURL: task.pageurl,
        websiteKey: task.sitekey,
        pageAction: task.action || 'verify',
        minScore: task.minScore || 0.3
      };
      break;
    case 'hcaptcha':
      data.task = {
        type: 'HCaptchaTaskProxyless',
        websiteURL: task.pageurl,
        websiteKey: task.sitekey
      };
      break;
    case 'image':
      data.task = {
        type: 'ImageToTextTask',
        body: task.imageBase64
      };
      break;
  }
  
  return data;
}

// DeathByCaptcha 데이터 준비
function prepareDeathByCaptchaData(task: CaptchaTask, apiKey: string): string {
  const params = new URLSearchParams();
  params.append('username', 'demo_user');
  params.append('password', apiKey);
  
  switch (task.type) {
    case 'recaptcha_v2':
      params.append('type', '4');
      params.append('token_params', JSON.stringify({
        googlekey: task.sitekey,
        pageurl: task.pageurl
      }));
      break;
    case 'image':
      params.append('captchafile', task.imageBase64!);
      break;
  }
  
  return params.toString();
}

// 2Captcha 결과 폴링
async function poll2CaptchaResult(captchaId: string, service: CaptchaService): Promise<string> {
  const maxAttempts = 40; // 최대 2분 대기
  const interval = 3000; // 3초 간격
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, interval));
    
    try {
      const response = await axios.get(`${service.baseUrl}/res.php`, {
        params: {
          key: service.apiKey,
          action: 'get',
          id: captchaId
        },
        timeout: 10000
      });
      
      if (response.data === 'CAPCHA_NOT_READY') {
        continue;
      }
      
      if (response.data.startsWith('OK|')) {
        return response.data.split('|')[1];
      }
      
      throw new Error(`2Captcha error: ${response.data}`);
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw error;
      }
    }
  }
  
  throw new Error('2Captcha timeout');
}

// AntiCaptcha 결과 폴링
async function pollAntiCaptchaResult(taskId: number, service: CaptchaService): Promise<string> {
  const maxAttempts = 40;
  const interval = 3000;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, interval));
    
    try {
      const response = await axios.post(`${service.baseUrl}/getTaskResult`, {
        clientKey: service.apiKey,
        taskId: taskId
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      if (response.data.errorId !== 0) {
        throw new Error(`AntiCaptcha error: ${response.data.errorDescription}`);
      }
      
      if (response.data.status === 'processing') {
        continue;
      }
      
      if (response.data.status === 'ready') {
        return response.data.solution.gRecaptchaResponse || response.data.solution.text;
      }
      
      throw new Error(`AntiCaptcha unexpected status: ${response.data.status}`);
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw error;
      }
    }
  }
  
  throw new Error('AntiCaptcha timeout');
}

// CAPTCHA 비용 계산
function getCaptchaCost(type: string, service: string): number {
  const costs: { [key: string]: { [key: string]: number } } = {
    '2captcha': {
      'recaptcha_v2': 0.001,
      'recaptcha_v3': 0.002,
      'hcaptcha': 0.001,
      'image': 0.0005
    },
    'anticaptcha': {
      'recaptcha_v2': 0.001,
      'recaptcha_v3': 0.002,
      'hcaptcha': 0.001,
      'image': 0.0005
    },
    'deathbycaptcha': {
      'recaptcha_v2': 0.0015,
      'image': 0.001
    }
  };
  
  return costs[service]?.[type] || 0.001;
}

// YouTube 특화 CAPTCHA 해결
export async function solveYouTubeCaptcha(pageUrl: string, sitekey?: string): Promise<string | null> {
  logger.info(`Solving YouTube CAPTCHA for: ${pageUrl}`);
  
  try {
    // reCAPTCHA v3 먼저 시도 (YouTube는 주로 v3 사용)
    if (sitekey) {
      const task: CaptchaTask = {
        id: `youtube_${Date.now()}`,
        type: 'recaptcha_v3',
        sitekey: sitekey,
        pageurl: pageUrl,
        action: 'verify',
        minScore: 0.3
      };
      
      const result = await solveCaptcha(task);
      if (result.success && result.solution) {
        return result.solution;
      }
    }
    
    // v3 실패 시 v2 시도
    const fallbackTask: CaptchaTask = {
      id: `youtube_fallback_${Date.now()}`,
      type: 'recaptcha_v2',
      sitekey: sitekey || '6LfC4AkTAAAAABhyvw29CiQph0hQD6-bAsEwUeI7', // YouTube 기본 sitekey
      pageurl: pageUrl
    };
    
    const fallbackResult = await solveCaptcha(fallbackTask);
    return fallbackResult.success ? fallbackResult.solution || null : null;
    
  } catch (error) {
    logger.error(`YouTube CAPTCHA solving failed: ${error}`);
    return null;
  }
}

// CAPTCHA 서비스 상태 확인
export async function checkCaptchaServicesStatus(): Promise<{ [key: string]: boolean }> {
  const status: { [key: string]: boolean } = {};
  
  for (const service of CAPTCHA_SERVICES) {
    try {
      let endpoint = '';
      let testData: any = {};
      
      switch (service.name) {
        case '2captcha':
          endpoint = `${service.baseUrl}/res.php?key=${service.apiKey}&action=getbalance`;
          break;
        case 'anticaptcha':
          endpoint = `${service.baseUrl}/getBalance`;
          testData = { clientKey: service.apiKey };
          break;
        case 'deathbycaptcha':
          endpoint = `${service.baseUrl}/api/user`;
          testData = { username: 'demo_user', password: service.apiKey };
          break;
      }
      
      const response = await axios.post(endpoint, testData, { timeout: 10000 });
      status[service.name] = response.status === 200;
    } catch (error) {
      status[service.name] = false;
    }
  }
  
  return status;
}
