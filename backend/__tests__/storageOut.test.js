const request = require('supertest');
const { mockGetConnection, mockConnection, resetMocks } = require('./testSetup');
const { app } = require('../server');

afterEach(() => {
  resetMocks();
});

describe('POST /api/storage-out', () => {
  it('should return 400 when epcs is missing', async () => {
    const res = await request(app)
      .post('/api/storage-out')
      .send({ petugas_name: 'Operator B' });

    expect(res.status).toBe(400);
  });

  it('should return 400 when epcs is empty', async () => {
    const res = await request(app)
      .post('/api/storage-out')
      .send({ epcs: [], petugas_name: 'Operator B' });

    expect(res.status).toBe(400);
  });

  it('should return 400 when petugas_name is missing', async () => {
    const res = await request(app)
      .post('/api/storage-out')
      .send({ epcs: ['EPC-001'] });

    expect(res.status).toBe(400);
  });

  it('should return 200 on successful storage-out', async () => {
    mockGetConnection((cb) => {
      mockConnection.query.mockImplementation((sql, params, doneCb) => {
        doneCb(null, { affectedRows: 1 });
      });
      cb(null, mockConnection);
    });

    const res = await request(app)
      .post('/api/storage-out')
      .send({ epcs: ['EPC-001', 'EPC-002'], petugas_name: 'Operator B' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/completed successfully/i);
    // 1 procedure call per EPC
    expect(mockConnection.query).toHaveBeenCalledTimes(2);
  });

  it('should return 500 when database connection fails', async () => {
    mockGetConnection((cb) => cb(new Error('Connection refused')));

    const res = await request(app)
      .post('/api/storage-out')
      .send({ epcs: ['EPC-001'], petugas_name: 'Operator B' });

    expect(res.status).toBe(500);
  });

  it('should return 500 when stored procedure fails', async () => {
    mockGetConnection((cb) => {
      mockConnection.query.mockImplementation((sql, params, doneCb) => {
        doneCb(new Error('Procedure error'));
      });
      cb(null, mockConnection);
    });

    const res = await request(app)
      .post('/api/storage-out')
      .send({ epcs: ['EPC-001'], petugas_name: 'Operator B' });

    expect(res.status).toBe(500);
  });
});
