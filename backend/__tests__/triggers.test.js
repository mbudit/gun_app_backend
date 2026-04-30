const request = require('supertest');
require('./testSetup');
const { app } = require('../server');

describe('GET /api/force-refresh', () => {
  it('returns 200 and broadcast confirmation', async () => {
    const res = await request(app).get('/api/force-refresh');
    expect(res.status).toBe(200);
    expect(res.text).toContain('data_changed');
  });
});

describe('POST /api/internal-trigger-refresh', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, TRIGGER_SECRET: 'test-secret-123' };
  });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 403 when secret header is missing', async () => {
    const res = await request(app).post('/api/internal-trigger-refresh');
    expect(res.status).toBe(403);
  });

  it('returns 403 when secret header is wrong', async () => {
    const res = await request(app)
      .post('/api/internal-trigger-refresh')
      .set('x-trigger-secret', 'wrong-secret');
    expect(res.status).toBe(403);
  });

  it('returns 200 when secret header is correct', async () => {
    const res = await request(app)
      .post('/api/internal-trigger-refresh')
      .set('x-trigger-secret', 'test-secret-123');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Broadcast initiated');
  });
});
