import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/app';
import { User } from '../../src/modules/user/user.model';
import { RefreshToken } from '../../src/modules/auth/refreshToken.model';
import { Role } from '../../src/common/constants/roles.enum';

let mongoServer: MongoMemoryServer;

describe('Auth & User Module Integration Tests', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoUri);
  }, 30000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await RefreshToken.deleteMany({});
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }, 30000);

  beforeEach(async () => {
    await User.deleteMany({});
    await RefreshToken.deleteMany({});
  });

  describe('POST /api/v1/auth/register', () => {
    it('should reject public self-registration with 403 Forbidden to prevent orphan users', async () => {
      const payload = {
        fullName: 'John Member',
        email: 'member@example.com',
        phone: '1234567890',
        password: 'Password123',
        role: Role.MEMBER,
      };

      const res = await request(app).post('/api/v1/auth/register').send(payload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Public self-registration is disabled');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await User.create({
        fullName: 'John Owner',
        email: 'owner@example.com',
        phone: '1234567890',
        password: 'Password123',
        role: Role.GYM_OWNER,
        isActive: true,
      });
    });

    it('should authenticate valid credentials and set httpOnly refresh cookie', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'owner@example.com',
        password: 'Password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.password).toBeUndefined();

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('refreshToken=');
      expect(cookies[0]).toContain('HttpOnly');
    });

    it('should reject invalid password with 401 Unauthorized', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'owner@example.com',
        password: 'WrongPassword123',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should lock account after 5 consecutive failed login attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/v1/auth/login').send({
          email: 'owner@example.com',
          password: 'WrongPassword123',
        });
      }

      // 6th attempt should return locked account error message
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'owner@example.com',
        password: 'Password123', // even with correct password!
      });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Account is temporarily locked');
    });
  });

  describe('POST /api/v1/auth/refresh-token & Theft Detection', () => {
    it('should rotate refresh token and revoke old token on reuse', async () => {
      // 1. Create User & Login
      await User.create({
        fullName: 'John Member',
        email: 'member@example.com',
        phone: '1234567890',
        password: 'Password123',
        role: Role.MEMBER,
      });

      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'member@example.com',
        password: 'Password123',
      });

      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const cookieStr = cookies[0];

      // 2. Perform refresh
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Cookie', [cookieStr]);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data.accessToken).toBeDefined();

      // 3. Attempt reuse of old refresh token (simulating attacker token theft)
      const reuseRes = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Cookie', [cookieStr]);

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.message).toContain('Session invalidated due to suspicious activity');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return user profile when authenticated with Bearer token', async () => {
      await User.create({
        fullName: 'John Member',
        email: 'member@example.com',
        phone: '1234567890',
        password: 'Password123',
        role: Role.MEMBER,
      });

      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'member@example.com',
        password: 'Password123',
      });

      const token = loginRes.body.data.accessToken;

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.email).toBe('member@example.com');
    });
  });
});
