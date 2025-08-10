import { logger } from '../utils/logger';
import { getRedisClient } from '../utils/redis';

interface UserBehaviorData {
  userId: string;
  sessionId: string;
  timestamp: number;
  actions: UserAction[];
  fingerprint: any;
  environment: BrowserEnvironment;
}

interface UserAction {
  type: 'click' | 'scroll' | 'keyboard' | 'mouse_move' | 'page_view' | 'video_request';
  timestamp: number;
  coordinates?: { x: number; y: number };
  element?: string;
  value?: any;
  duration?: number;
}

interface BrowserEnvironment {
  userAgent: string;
  screen: { width: number; height: number };
  timezone: string;
  language: string;
  platform: string;
  connection?: any;
}

interface BehaviorPattern {
  userId: string;
  patternType: 'human' | 'bot' | 'suspicious';
  confidence: number;
  features: {
    mouseMovements: MousePattern;
    clickPatterns: ClickPattern;
    timingPatterns: TimingPattern;
    navigationPatterns: NavigationPattern;
  };
  riskScore: number;
  lastUpdated: number;
}

interface MousePattern {
  averageSpeed: number;
  acceleration: number;
  jerkiness: number;
  pauseFrequency: number;
  naturalCurves: boolean;
}

interface ClickPattern {
  averageInterval: number;
  variability: number;
  doubleClickRate: number;
  accuracy: number;
}

interface TimingPattern {
  requestInterval: number;
  sessionDuration: number;
  activeTime: number;
  idleTime: number;
}

interface NavigationPattern {
  pagesPerSession: number;
  backButtonUsage: number;
  tabSwitching: number;
  scrollDepth: number;
}

// 머신러닝 기반 행동 분석기
export class BehaviorAnalyzer {
  private redis = getRedisClient();
  private patterns: Map<string, BehaviorPattern> = new Map();

  // 사용자 행동 데이터 수집
  async collectBehaviorData(behaviorData: UserBehaviorData): Promise<void> {
    try {
      logger.info(`Collecting behavior data for user: ${behaviorData.userId}`);

      // Redis에 원시 데이터 저장
      const key = `behavior:raw:${behaviorData.userId}:${behaviorData.timestamp}`;
      await this.redis.setEx(key, 86400, JSON.stringify(behaviorData)); // 24시간 저장

      // 실시간 패턴 분석
      await this.analyzeRealTimePattern(behaviorData);

    } catch (error) {
      logger.error(`Failed to collect behavior data: ${error}`);
    }
  }

  // 실시간 패턴 분석
  private async analyzeRealTimePattern(behaviorData: UserBehaviorData): Promise<void> {
    try {
      // 기존 패턴 가져오기
      let pattern = await this.getUserPattern(behaviorData.userId);
      
      if (!pattern) {
        pattern = this.initializeUserPattern(behaviorData.userId);
      }

      // 새로운 행동 데이터로 패턴 업데이트
      pattern = this.updatePattern(pattern, behaviorData);

      // 머신러닝 분류 수행
      pattern = await this.classifyBehavior(pattern, behaviorData);

      // 패턴 저장
      await this.saveUserPattern(pattern);

      // 의심스러운 행동 감지 시 알림
      if (pattern.riskScore > 0.8) {
        logger.warn(`High risk behavior detected for user: ${behaviorData.userId}, score: ${pattern.riskScore}`);
        await this.handleSuspiciousBehavior(pattern, behaviorData);
      }

    } catch (error) {
      logger.error(`Real-time pattern analysis failed: ${error}`);
    }
  }

  // 사용자 패턴 초기화
  private initializeUserPattern(userId: string): BehaviorPattern {
    return {
      userId,
      patternType: 'human', // 기본값
      confidence: 0.5,
      features: {
        mouseMovements: {
          averageSpeed: 0,
          acceleration: 0,
          jerkiness: 0,
          pauseFrequency: 0,
          naturalCurves: true
        },
        clickPatterns: {
          averageInterval: 0,
          variability: 0,
          doubleClickRate: 0,
          accuracy: 0
        },
        timingPatterns: {
          requestInterval: 0,
          sessionDuration: 0,
          activeTime: 0,
          idleTime: 0
        },
        navigationPatterns: {
          pagesPerSession: 0,
          backButtonUsage: 0,
          tabSwitching: 0,
          scrollDepth: 0
        }
      },
      riskScore: 0.1,
      lastUpdated: Date.now()
    };
  }

  // 패턴 업데이트
  private updatePattern(pattern: BehaviorPattern, behaviorData: UserBehaviorData): BehaviorPattern {
    const actions = behaviorData.actions;
    
    // 마우스 움직임 분석
    const mouseActions = actions.filter(a => a.type === 'mouse_move');
    if (mouseActions.length > 0) {
      pattern.features.mouseMovements = this.analyzeMouseMovements(mouseActions);
    }

    // 클릭 패턴 분석
    const clickActions = actions.filter(a => a.type === 'click');
    if (clickActions.length > 0) {
      pattern.features.clickPatterns = this.analyzeClickPatterns(clickActions);
    }

    // 타이밍 패턴 분석
    pattern.features.timingPatterns = this.analyzeTimingPatterns(actions);

    // 네비게이션 패턴 분석
    const navigationActions = actions.filter(a => ['page_view', 'scroll'].includes(a.type));
    if (navigationActions.length > 0) {
      pattern.features.navigationPatterns = this.analyzeNavigationPatterns(navigationActions);
    }

    pattern.lastUpdated = Date.now();
    return pattern;
  }

  // 마우스 움직임 분석
  private analyzeMouseMovements(mouseActions: UserAction[]): MousePattern {
    let totalDistance = 0;
    let totalTime = 0;
    let accelerations: number[] = [];
    let pauses = 0;
    let curves = 0;

    for (let i = 1; i < mouseActions.length; i++) {
      const prev = mouseActions[i - 1];
      const curr = mouseActions[i];

      if (prev.coordinates && curr.coordinates) {
        // 거리 계산
        const distance = Math.sqrt(
          Math.pow(curr.coordinates.x - prev.coordinates.x, 2) +
          Math.pow(curr.coordinates.y - prev.coordinates.y, 2)
        );
        totalDistance += distance;

        // 시간 계산
        const timeDiff = curr.timestamp - prev.timestamp;
        totalTime += timeDiff;

        // 가속도 계산
        if (timeDiff > 0) {
          const speed = distance / timeDiff;
          if (i > 1) {
            const prevSpeed = accelerations[accelerations.length - 1] || 0;
            const acceleration = Math.abs(speed - prevSpeed);
            accelerations.push(acceleration);
          }
        }

        // 일시정지 감지 (100ms 이상 멈춤)
        if (timeDiff > 100 && distance < 5) {
          pauses++;
        }

        // 자연스러운 곡선 감지
        if (i > 1 && mouseActions[i - 2].coordinates) {
          const angle1 = this.calculateAngle(mouseActions[i - 2].coordinates!, prev.coordinates);
          const angle2 = this.calculateAngle(prev.coordinates, curr.coordinates);
          const angleDiff = Math.abs(angle1 - angle2);
          
          if (angleDiff > 10 && angleDiff < 170) { // 자연스러운 곡선
            curves++;
          }
        }
      }
    }

    const averageSpeed = totalTime > 0 ? totalDistance / totalTime : 0;
    const averageAcceleration = accelerations.length > 0 ? 
      accelerations.reduce((a, b) => a + b) / accelerations.length : 0;
    const jerkiness = accelerations.length > 0 ? 
      Math.sqrt(accelerations.map(a => a * a).reduce((a, b) => a + b) / accelerations.length) : 0;

    return {
      averageSpeed,
      acceleration: averageAcceleration,
      jerkiness,
      pauseFrequency: mouseActions.length > 0 ? pauses / mouseActions.length : 0,
      naturalCurves: curves > mouseActions.length * 0.1 // 10% 이상이 자연스러운 곡선
    };
  }

  // 클릭 패턴 분석
  private analyzeClickPatterns(clickActions: UserAction[]): ClickPattern {
    const intervals: number[] = [];
    let doubleClicks = 0;
    let totalAccuracy = 0;

    for (let i = 1; i < clickActions.length; i++) {
      const interval = clickActions[i].timestamp - clickActions[i - 1].timestamp;
      intervals.push(interval);

      // 더블클릭 감지 (500ms 이내)
      if (interval < 500) {
        doubleClicks++;
      }
    }

    const averageInterval = intervals.length > 0 ? 
      intervals.reduce((a, b) => a + b) / intervals.length : 0;
    
    const variability = intervals.length > 1 ? 
      Math.sqrt(intervals.map(i => Math.pow(i - averageInterval, 2)).reduce((a, b) => a + b) / intervals.length) : 0;

    return {
      averageInterval,
      variability,
      doubleClickRate: clickActions.length > 0 ? doubleClicks / clickActions.length : 0,
      accuracy: totalAccuracy / clickActions.length || 0
    };
  }

  // 타이밍 패턴 분석
  private analyzeTimingPatterns(actions: UserAction[]): TimingPattern {
    if (actions.length === 0) {
      return {
        requestInterval: 0,
        sessionDuration: 0,
        activeTime: 0,
        idleTime: 0
      };
    }

    const videoRequests = actions.filter(a => a.type === 'video_request');
    const requestIntervals: number[] = [];

    for (let i = 1; i < videoRequests.length; i++) {
      requestIntervals.push(videoRequests[i].timestamp - videoRequests[i - 1].timestamp);
    }

    const sessionStart = Math.min(...actions.map(a => a.timestamp));
    const sessionEnd = Math.max(...actions.map(a => a.timestamp));
    const sessionDuration = sessionEnd - sessionStart;

    // 활성/비활성 시간 계산
    let activeTime = 0;
    let idleTime = 0;
    
    for (let i = 1; i < actions.length; i++) {
      const gap = actions[i].timestamp - actions[i - 1].timestamp;
      if (gap < 5000) { // 5초 이내는 활성
        activeTime += gap;
      } else {
        idleTime += gap;
      }
    }

    return {
      requestInterval: requestIntervals.length > 0 ? 
        requestIntervals.reduce((a, b) => a + b) / requestIntervals.length : 0,
      sessionDuration,
      activeTime,
      idleTime
    };
  }

  // 네비게이션 패턴 분석
  private analyzeNavigationPatterns(navigationActions: UserAction[]): NavigationPattern {
    const pageViews = navigationActions.filter(a => a.type === 'page_view').length;
    const scrollActions = navigationActions.filter(a => a.type === 'scroll');
    
    let maxScrollDepth = 0;
    scrollActions.forEach(action => {
      if (action.value && typeof action.value.scrollY === 'number') {
        maxScrollDepth = Math.max(maxScrollDepth, action.value.scrollY);
      }
    });

    return {
      pagesPerSession: pageViews,
      backButtonUsage: 0, // 추후 구현
      tabSwitching: 0, // 추후 구현
      scrollDepth: maxScrollDepth
    };
  }

  // 머신러닝 분류 수행
  private async classifyBehavior(pattern: BehaviorPattern, behaviorData: UserBehaviorData): Promise<BehaviorPattern> {
    try {
      // 특징 벡터 생성
      const features = this.extractFeatureVector(pattern, behaviorData);
      
      // 간단한 규칙 기반 분류 (실제로는 더 복잡한 ML 모델 사용)
      const classification = this.ruleBasedClassification(features);
      
      pattern.patternType = classification.type;
      pattern.confidence = classification.confidence;
      pattern.riskScore = classification.riskScore;

      return pattern;
    } catch (error) {
      logger.error(`Behavior classification failed: ${error}`);
      return pattern;
    }
  }

  // 특징 벡터 추출
  private extractFeatureVector(pattern: BehaviorPattern, behaviorData: UserBehaviorData): number[] {
    const features = pattern.features;
    
    return [
      features.mouseMovements.averageSpeed,
      features.mouseMovements.acceleration,
      features.mouseMovements.jerkiness,
      features.mouseMovements.pauseFrequency,
      features.mouseMovements.naturalCurves ? 1 : 0,
      features.clickPatterns.averageInterval,
      features.clickPatterns.variability,
      features.clickPatterns.doubleClickRate,
      features.timingPatterns.requestInterval,
      features.timingPatterns.sessionDuration / 1000, // 초 단위
      features.timingPatterns.activeTime / features.timingPatterns.sessionDuration || 0,
      features.navigationPatterns.scrollDepth / 1000, // 정규화
      behaviorData.actions.length / (features.timingPatterns.sessionDuration / 1000) || 0 // 초당 액션 수
    ];
  }

  // 규칙 기반 분류
  private ruleBasedClassification(features: number[]): { type: 'human' | 'bot' | 'suspicious', confidence: number, riskScore: number } {
    let botScore = 0;
    let humanScore = 0;

    // 마우스 움직임 분석
    const avgSpeed = features[0];
    const jerkiness = features[2];
    const naturalCurves = features[4];

    if (avgSpeed > 1000 || avgSpeed < 10) botScore += 0.3; // 너무 빠르거나 느림
    if (jerkiness < 5) botScore += 0.2; // 너무 부드러움
    if (naturalCurves === 0) botScore += 0.2; // 자연스러운 곡선 없음

    // 클릭 패턴 분석
    const clickInterval = features[5];
    const clickVariability = features[6];

    if (clickInterval < 100 || clickInterval > 10000) botScore += 0.2;
    if (clickVariability < 50) botScore += 0.3; // 너무 일정함

    // 타이밍 패턴 분석
    const requestInterval = features[8];
    const actionsPerSecond = features[12];

    if (requestInterval < 1000) botScore += 0.4; // 너무 빠른 요청
    if (actionsPerSecond > 10) botScore += 0.3; // 너무 많은 액션

    humanScore = 1 - botScore;

    let type: 'human' | 'bot' | 'suspicious';
    let confidence: number;
    let riskScore: number;

    if (botScore > 0.7) {
      type = 'bot';
      confidence = botScore;
      riskScore = botScore;
    } else if (botScore > 0.4) {
      type = 'suspicious';
      confidence = 0.6;
      riskScore = botScore;
    } else {
      type = 'human';
      confidence = humanScore;
      riskScore = botScore;
    }

    return { type, confidence, riskScore };
  }

  // 의심스러운 행동 처리
  private async handleSuspiciousBehavior(pattern: BehaviorPattern, behaviorData: UserBehaviorData): Promise<void> {
    try {
      // 의심스러운 행동 로그 저장
      const suspiciousLog = {
        userId: pattern.userId,
        timestamp: Date.now(),
        riskScore: pattern.riskScore,
        patternType: pattern.patternType,
        reason: this.generateSuspiciousReason(pattern),
        behaviorData: behaviorData
      };

      await this.redis.setEx(
        `suspicious:${pattern.userId}:${Date.now()}`,
        604800, // 7일
        JSON.stringify(suspiciousLog)
      );

      // 추가 보안 조치
      if (pattern.riskScore > 0.9) {
        await this.applySecurityMeasures(pattern.userId);
      }

    } catch (error) {
      logger.error(`Failed to handle suspicious behavior: ${error}`);
    }
  }

  // 의심스러운 이유 생성
  private generateSuspiciousReason(pattern: BehaviorPattern): string[] {
    const reasons: string[] = [];

    if (pattern.features.mouseMovements.averageSpeed > 1000) {
      reasons.push('Abnormally fast mouse movements');
    }
    if (pattern.features.clickPatterns.variability < 50) {
      reasons.push('Too consistent click intervals');
    }
    if (pattern.features.timingPatterns.requestInterval < 1000) {
      reasons.push('Too frequent requests');
    }
    if (!pattern.features.mouseMovements.naturalCurves) {
      reasons.push('Lack of natural mouse curves');
    }

    return reasons;
  }

  // 보안 조치 적용
  private async applySecurityMeasures(userId: string): Promise<void> {
    try {
      // 사용자 요청 제한
      await this.redis.setEx(`rate_limit:${userId}`, 3600, '1'); // 1시간 제한

      // 추가 인증 요구 플래그 설정
      await this.redis.setEx(`require_auth:${userId}`, 1800, '1'); // 30분

      logger.warn(`Security measures applied for user: ${userId}`);
    } catch (error) {
      logger.error(`Failed to apply security measures: ${error}`);
    }
  }

  // 사용자 패턴 가져오기
  private async getUserPattern(userId: string): Promise<BehaviorPattern | null> {
    try {
      const cached = this.patterns.get(userId);
      if (cached && Date.now() - cached.lastUpdated < 300000) { // 5분 캐시
        return cached;
      }

      const data = await this.redis.get(`pattern:${userId}`);
      if (data) {
        const pattern = JSON.parse(data);
        this.patterns.set(userId, pattern);
        return pattern;
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get user pattern: ${error}`);
      return null;
    }
  }

  // 사용자 패턴 저장
  private async saveUserPattern(pattern: BehaviorPattern): Promise<void> {
    try {
      this.patterns.set(pattern.userId, pattern);
      await this.redis.setEx(`pattern:${pattern.userId}`, 86400, JSON.stringify(pattern));
    } catch (error) {
      logger.error(`Failed to save user pattern: ${error}`);
    }
  }

  // 각도 계산
  private calculateAngle(point1: { x: number; y: number }, point2: { x: number; y: number }): number {
    return Math.atan2(point2.y - point1.y, point2.x - point1.x) * 180 / Math.PI;
  }

  // 사용자 위험도 확인
  async getUserRiskScore(userId: string): Promise<number> {
    const pattern = await this.getUserPattern(userId);
    return pattern?.riskScore || 0.1;
  }

  // 봇 여부 확인
  async isBotUser(userId: string): Promise<boolean> {
    const pattern = await this.getUserPattern(userId);
    return pattern?.patternType === 'bot' && pattern.confidence > 0.7;
  }
}

// 글로벌 행동 분석기 인스턴스
export const behaviorAnalyzer = new BehaviorAnalyzer();
