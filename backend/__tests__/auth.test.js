const request = require('supertest');
const bcrypt = require('bcrypt');
const { mockGetConnection, mockConnection, resetMocks } = require('./testSetup');
const { app } = require('../server');

afterEach(() => {
  resetMocks();
});

// ═══════════════════════════════════════════════════════════════════
//  POST /api/login
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/login', () => {
  it('should return 400 when username is missing', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ password: 'secret' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/username/i);
  });

  it('should return 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'john' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('should return 401 when user is not found', async () => {
    mockGetConnection((cb) => {
      mockConnection.query.mockImplementation((sql, params, cb) => cb(null, []));
      cb(null, mockConnection);
    });

    const res = await request(app)
      .post('/api/login')
      .send({ username: 'nonexistent', password: 'secret' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('should return 401 when password does not match', async () => {
    const hash = await bcrypt.hash('correct_password', 10);

    mockGetConnection((cb) => {
      mockConnection.query.mockImplementation((sql, params, cb) => {
        cb(null, [{ username: 'john', password_hash: hash, name: 'John' }]);
      });
      cb(null, mockConnection);
    });

    const res = await request(app)
      .post('/api/login')
      .send({ username: 'john', password: 'wrong_password' });

    expect(res.status).toBe(401);
  });

  it('should return 200 and user data on valid credentials', async () => {
    const hash = await bcrypt.hash('secret123', 10);

    mockGetConnection((cb) => {
      mockConnection.query.mockImplementation((sql, params, cb) => {
        cb(null, [{ username: 'john', password_hash: hash, name: 'John Doe' }]);
      });
      cb(null, mockConnection);
    });

    const res = await request(app)
      .post('/api/login')
      .send({ username: 'john', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Login successful');
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('john');
    expect(res.body.user.name).toBe('John Doe');
  });

  it('should return 500 when database connection fails', async () => {
    mockGetConnection((cb) => cb(new Error('Connection refused')));

    const res = await request(app)
      .post('/api/login')
      .send({ username: 'john', password: 'secret' });

    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  POST /api/register
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/register', () => {
  it('should return 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'john' }); // missing password and name

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('should return 201 on successful registration', async () => {
    mockGetConnection((cb) => {
      mockConnection.query.mockImplementation((sql, params, cb) => {
        cb(null, { insertId: 1 });
      });
      cb(null, mockConnection);
    });

    const res = await request(app)
      .post('/api/register')
      .send({ username: 'newuser', password: 'pass123', name: 'New User' });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/registered/i);
  });

  it('should return 409 when username already exists', async () => {
    mockGetConnection((cb) => {
      mockConnection.query.mockImplementation((sql, params, cb) => {
        const err = new Error('Duplicate entry');
        err.code = 'ER_DUP_ENTRY';
        cb(err);
      });
      cb(null, mockConnection);
    });

    const res = await request(app)
      .post('/api/register')
      .send({ username: 'existing', password: 'pass123', name: 'Exists' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });
});
