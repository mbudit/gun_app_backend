const request = require('supertest');
require('./testSetup'); // must come before requiring server
const { app } = require('../server');

describe('GET / — Health Check', () => {
  it('should return 200 and the running message', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('RFID Backend Server is running');
  });
});
