const request = require('supertest');
const { mockGetConnection, mockConnection, resetMocks } = require('./testSetup');
const { app } = require('../server');

afterEach(() => {
  resetMocks();
});

describe('POST /api/batch-out', () => {
  it('should return 400 when batch_out_id is missing', async () => {
    const res = await request(app)
      .post('/api/batch-out')
      .send({ epcs: ['EPC-001'], storage_type: 'Clean', petugas_name: 'Op A' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 when epcs is empty', async () => {
    const res = await request(app)
      .post('/api/batch-out')
      .send({ batch_out_id: 'BOUT-001', epcs: [], storage_type: 'Clean', petugas_name: 'Op A' });

    expect(res.status).toBe(400);
  });

  it('should return 400 when epcs is not an array', async () => {
    const res = await request(app)
      .post('/api/batch-out')
      .send({ batch_out_id: 'BOUT-001', epcs: 'EPC-001', storage_type: 'Clean', petugas_name: 'Op A' });

    expect(res.status).toBe(400);
  });

  it('should return 400 when storage_type is missing', async () => {
    const res = await request(app)
      .post('/api/batch-out')
      .send({ batch_out_id: 'BOUT-001', epcs: ['EPC-001'], petugas_name: 'Op A' });

    expect(res.status).toBe(400);
  });

  it('should return 400 when petugas_name is missing', async () => {
    const res = await request(app)
      .post('/api/batch-out')
      .send({ batch_out_id: 'BOUT-001', epcs: ['EPC-001'], storage_type: 'Clean' });

    expect(res.status).toBe(400);
  });

  it('should return 200 on successful batch-out with single EPC', async () => {
    // For 1 EPC, there are 2 stored procedure calls (BATCH_OUT_READ + STORAGE_IN_READ)
    mockGetConnection((cb) => {
      mockConnection.query.mockImplementation((sql, params, doneCb) => {
        doneCb(null, { affectedRows: 1 });
      });
      cb(null, mockConnection);
    });

    const res = await request(app)
      .post('/api/batch-out')
      .send({
        batch_out_id: 'BOUT-001',
        epcs: ['EPC-001'],
        storage_type: 'Clean',
        petugas_name: 'Operator A',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/completed successfully/i);
    // 2 procedure calls for 1 EPC
    expect(mockConnection.query).toHaveBeenCalledTimes(2);
  });

  it('should return 200 on successful batch-out with multiple EPCs', async () => {
    mockGetConnection((cb) => {
      mockConnection.query.mockImplementation((sql, params, doneCb) => {
        doneCb(null, { affectedRows: 1 });
      });
      cb(null, mockConnection);
    });

    const res = await request(app)
      .post('/api/batch-out')
      .send({
        batch_out_id: 'BOUT-002',
        epcs: ['EPC-001', 'EPC-002', 'EPC-003'],
        storage_type: 'Clean',
        petugas_name: 'Operator A',
      });

    expect(res.status).toBe(200);
    // 2 procedures × 3 EPCs = 6 calls
    expect(mockConnection.query).toHaveBeenCalledTimes(6);
  });

  it('should return 500 when database connection fails', async () => {
    mockGetConnection((cb) => cb(new Error('Connection refused')));

    const res = await request(app)
      .post('/api/batch-out')
      .send({
        batch_out_id: 'BOUT-001',
        epcs: ['EPC-001'],
        storage_type: 'Clean',
        petugas_name: 'Operator A',
      });

    expect(res.status).toBe(500);
  });

  it('should return 500 when a stored procedure fails', async () => {
    mockGetConnection((cb) => {
      // First procedure call fails; subsequent calls succeed (server guards with hasError)
      mockConnection.query
        .mockImplementationOnce((sql, params, doneCb) => {
          doneCb(new Error('Procedure error'));
        })
        .mockImplementation((sql, params, doneCb) => {
          // no-op: response already sent
        });
      cb(null, mockConnection);
    });

    const res = await request(app)
      .post('/api/batch-out')
      .send({
        batch_out_id: 'BOUT-001',
        epcs: ['EPC-001'],
        storage_type: 'Clean',
        petugas_name: 'Operator A',
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
