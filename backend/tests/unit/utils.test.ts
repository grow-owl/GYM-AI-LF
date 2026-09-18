import { AppError } from '../../src/common/utils/AppError';
import { getPaginationParams, buildPaginationMeta } from '../../src/common/utils/pagination';
import { generateAccessToken, verifyAccessToken } from '../../src/common/utils/generateTokens';
import { Role } from '../../src/common/constants/roles.enum';

describe('Common Utilities Unit Tests', () => {
  describe('AppError', () => {
    it('should correctly format a Bad Request error', () => {
      const error = AppError.badRequest('Invalid input data');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input data');
      expect(error.isOperational).toBe(true);
    });

    it('should correctly format a Not Found error', () => {
      const error = AppError.notFound('Member not found');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Member not found');
    });
  });

  describe('Pagination Utils', () => {
    it('should calculate correct skip and limit defaults', () => {
      const parsed = getPaginationParams({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.skip).toBe(0);
    });

    it('should cap limit to maxLimit', () => {
      const parsed = getPaginationParams({ limit: 500, maxLimit: 100 });
      expect(parsed.limit).toBe(100);
    });

    it('should build pagination metadata accurately', () => {
      const meta = buildPaginationMeta(45, 1, 20);
      expect(meta.totalItems).toBe(45);
      expect(meta.totalPages).toBe(3);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPrevPage).toBe(false);
    });
  });

  describe('Token Generation Utils', () => {
    it('should sign and verify access token correctly', () => {
      const payload = { id: 'user_123', role: Role.GYM_OWNER, gymId: 'gym_001' };
      const token = generateAccessToken(payload);
      expect(typeof token).toBe('string');

      const decoded = verifyAccessToken(token);
      expect(decoded.id).toBe('user_123');
      expect(decoded.role).toBe(Role.GYM_OWNER);
      expect(decoded.gymId).toBe('gym_001');
    });
  });
});
