import { calculateDistanceMeters } from '../../src/common/utils/geo';
import { AIDataAggregatorService } from '../../src/modules/aiCoach/aiDataAggregator.service';

describe('New Features Unit Tests', () => {
  describe('Geo Distance Calculation (Haversine)', () => {
    it('should return 0 meters for identical lat/lng coordinates', () => {
      const distance = calculateDistanceMeters(28.6139, 77.209, 28.6139, 77.209);
      expect(distance).toBe(0);
    });

    it('should calculate accurate distance in meters between two known GPS coordinates', () => {
      // Distance between Connaught Place (28.6315, 77.2167) and India Gate (28.6129, 77.2295) is ~2.4 km (2400m)
      const distance = calculateDistanceMeters(28.6315, 77.2167, 28.6129, 77.2295);
      expect(distance).toBeGreaterThan(2000);
      expect(distance).toBeLessThan(3000);
    });
  });

  describe('AI Coach Recovery Score Calculation', () => {
    it('should compute Optimal Recovery score for great sleep, water, and rest days', () => {
      const result = AIDataAggregatorService.calculateRecoveryScore(8.0, 3000, 70, 3);
      expect(result.recoveryScore).toBeGreaterThanOrEqual(80);
      expect(result.recoveryCategory).toBe('Optimal Recovery');
    });

    it('should compute High Fatigue score for low sleep, low water, and heavy training', () => {
      const result = AIDataAggregatorService.calculateRecoveryScore(4.5, 1000, 90, 7);
      expect(result.recoveryScore).toBeLessThan(40);
      expect(result.recoveryCategory).toBe('High Fatigue / Rest Recommended');
    });

    it('should clamp recovery score strictly between 0 and 100', () => {
      const superHigh = AIDataAggregatorService.calculateRecoveryScore(12, 5000, 10, 1);
      expect(superHigh.recoveryScore).toBeLessThanOrEqual(100);

      const superLow = AIDataAggregatorService.calculateRecoveryScore(2, 200, 100, 7);
      expect(superLow.recoveryScore).toBeGreaterThanOrEqual(0);
    });
  });
});
