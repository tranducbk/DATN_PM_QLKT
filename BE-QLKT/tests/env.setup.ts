// Loaded via Jest `setupFiles` BEFORE any module is imported.
// Provides deterministic env values so configs that call `requireEnv()` succeed.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
