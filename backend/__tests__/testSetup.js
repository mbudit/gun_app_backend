/**
 * Shared test setup — mocks the mysql2 module so no real database is needed.
 *
 * Jest requires mock factory variables to be prefixed with `mock`.
 * We store the mutable implementations in `mock`-prefixed variables.
 */

// ── Mock connection object returned by getConnection ────────────────
const mockConnectionObj = {
  query: jest.fn(),
  release: jest.fn(),
};

// ── Mutable mock implementations (overridden per-test) ──────────────
let mockQueryImpl = (sql, params, cb) => cb(null, []);
let mockGetConnectionImpl = (cb) => cb(null, mockConnectionObj);

// ── Mock mysql2 BEFORE requiring server.js ──────────────────────────
jest.mock('mysql2', () => ({
  createPool: () => ({
    query: (...args) => mockQueryImpl(...args),
    getConnection: (cb) => mockGetConnectionImpl(cb),
  }),
}));

// ── Helpers to swap mock behaviour per test ─────────────────────────
function mockQuery(impl) {
  mockQueryImpl = impl;
}

function mockGetConnection(impl) {
  mockGetConnectionImpl = impl;
}

function resetMocks() {
  mockQueryImpl = (sql, params, cb) => cb(null, []);
  mockGetConnectionImpl = (cb) => cb(null, mockConnectionObj);
  mockConnectionObj.query.mockReset();
  mockConnectionObj.release.mockReset();
}

module.exports = {
  mockQuery,
  mockGetConnection,
  mockConnection: mockConnectionObj,
  resetMocks,
};
