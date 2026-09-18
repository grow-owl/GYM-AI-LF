import request from 'supertest';
import app from '../../src/app';

describe('GET /health', () => {
  it('should return 200 OK with system health status and X-Request-Id header', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.requestId).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
