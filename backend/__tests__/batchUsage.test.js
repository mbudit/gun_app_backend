const request = require('supertest');
const { mockQuery, mockGetConnection, mockConnection, resetMocks } = require('./testSetup');
const { app } = require('../server');

afterEach(() => { resetMocks(); });

describe('GET /api/batch-usage', () => {
  it('returns 200 with records', async () => {
    mockQuery((sql, cb) => cb(null, [{ id: 1 }]));
    const res = await request(app).get('/api/batch-usage');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
  it('returns 500 on DB error', async () => {
    mockQuery((sql, cb) => cb(new Error('fail')));
    const res = await request(app).get('/api/batch-usage');
    expect(res.status).toBe(500);
  });
});

describe('GET /api/batch-usage-details', () => {
  it('returns 200 with records', async () => {
    mockQuery((sql, cb) => cb(null, [{ epc: 'EPC-001' }]));
    const res = await request(app).get('/api/batch-usage-details');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
  it('returns 500 on DB error', async () => {
    mockQuery((sql, cb) => cb(new Error('fail')));
    const res = await request(app).get('/api/batch-usage-details');
    expect(res.status).toBe(500);
  });
});

describe('POST /api/batch-usage', () => {
  const validBody = {
    batch_usage_id: 'BU-001', epcs: ['EPC-001', 'EPC-002'],
    petugas_name: 'Op A', receiver_name: 'Ward B', receiver_location: 'Floor 3',
  };

  it('returns 400 when batch_usage_id is missing', async () => {
    const { batch_usage_id, ...body } = validBody;
    const res = await request(app).post('/api/batch-usage').send(body);
    expect(res.status).toBe(400);
  });
  it('returns 400 when epcs is empty', async () => {
    const res = await request(app).post('/api/batch-usage').send({ ...validBody, epcs: [] });
    expect(res.status).toBe(400);
  });
  it('returns 400 when receiver fields missing', async () => {
    const { receiver_name, ...body } = validBody;
    const res = await request(app).post('/api/batch-usage').send(body);
    expect(res.status).toBe(400);
  });
  it('returns 200 on success', async () => {
    mockGetConnection((cb) => {
      mockConnection.query.mockImplementation((sql, params, doneCb) => doneCb(null, {}));
      cb(null, mockConnection);
    });
    const res = await request(app).post('/api/batch-usage').send(validBody);
    expect(res.status).toBe(200);
    expect(mockConnection.query).toHaveBeenCalledTimes(2);
  });
  it('returns 500 on DB connection failure', async () => {
    mockGetConnection((cb) => cb(new Error('fail')));
    const res = await request(app).post('/api/batch-usage').send(validBody);
    expect(res.status).toBe(500);
  });
  it('returns 500 on procedure error', async () => {
    mockGetConnection((cb) => {
      mockConnection.query.mockImplementation((sql, params, doneCb) => doneCb(new Error('err')));
      cb(null, mockConnection);
    });
    const res = await request(app).post('/api/batch-usage').send(validBody);
    expect(res.status).toBe(500);
  });
});
