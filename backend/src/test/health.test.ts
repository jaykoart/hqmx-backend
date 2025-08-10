describe('Health Check', () => {
  test('should pass basic test', () => {
    expect(true).toBe(true);
  });

  test('should have NODE_ENV set', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});
