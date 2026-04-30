const request = require('supertest');
const { mockQuery, resetMocks } = require('./testSetup');
const { app } = require('../server');

afterEach(() => {
  resetMocks();
});

// ═══════════════════════════════════════════════════════════════════
//  GET /api/linens
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/linens', () => {
  it('should return 200 and an array of linens', async () => {
    const fakeLinens = [
      {
        LINEN_ID: 'EPC-001',
        LINEN_TYPE: 'Bed Sheet',
        LINEN_HEIGHT: 200,
        LINEN_WIDTH: 150,
        LINEN_MAX_CYCLE: 100,
        LINEN_DESCRIPTION: 'Standard white bed sheet',
        LINEN_CREATED_DATE: '2026-01-15',
        LINEN_SIZE_CATEGORY: 'Large',
      },
    ];

    mockQuery((sql, cb) => cb(null, fakeLinens));

    const res = await request(app).get('/api/linens');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].LINEN_ID).toBe('EPC-001');
  });

  it('should return 500 on database error', async () => {
    mockQuery((sql, cb) => cb(new Error('DB failure')));

    const res = await request(app).get('/api/linens');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  GET /api/batch-in
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/batch-in', () => {
  it('should return 200 and batch-in records', async () => {
    const fakeBatches = [
      { BATCH_IN_ID: 'BIN-001', BATCH_IN_DATETIME: '2026-04-10T08:00:00.000Z' },
    ];

    mockQuery((sql, cb) => cb(null, fakeBatches));

    const res = await request(app).get('/api/batch-in');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].BATCH_IN_ID).toBe('BIN-001');
  });

  it('should return 500 on database error', async () => {
    mockQuery((sql, cb) => cb(new Error('DB failure')));

    const res = await request(app).get('/api/batch-in');
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  GET /api/batch-in-details
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/batch-in-details', () => {
  it('should return 200 and detail records', async () => {
    const fakeDetails = [
      { BATCH_IN_ID: 'BIN-001', LINEN_ID: 'EPC-001' },
    ];

    mockQuery((sql, cb) => cb(null, fakeDetails));

    const res = await request(app).get('/api/batch-in-details');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('should return 500 on database error', async () => {
    mockQuery((sql, cb) => cb(new Error('DB failure')));

    const res = await request(app).get('/api/batch-in-details');
    expect(res.status).toBe(500);
  });
});
