// Jest 테스트 설정
import { config } from 'dotenv';

// 테스트 환경 변수 로드
config({ path: '.env.test' });

// 전역 테스트 설정
beforeAll(() => {
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // 테스트 후 정리
});
