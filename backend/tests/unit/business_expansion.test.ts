import { AIDataAggregatorService } from '../../src/modules/aiCoach/aiDataAggregator.service';

describe('Business Expansion Unit Tests', () => {
  describe('Member Churn Risk Calculator (AIDataAggregatorService.calculateChurnRisk)', () => {
    it('should return high risk when daysSinceLastVisit is >= 14', () => {
      const result = AIDataAggregatorService.calculateChurnRisk(16, 0);
      expect(result.riskLevel).toBe('high');
      expect(result.riskFactors).toContain('No visit in 16 days');
    });

    it('should return medium risk when daysSinceLastVisit >= 7 and completion rate dropped > 30%', () => {
      const result = AIDataAggregatorService.calculateChurnRisk(8, 35);
      expect(result.riskLevel).toBe('medium');
      expect(result.riskFactors).toContain('No visit in 8 days');
      expect(result.riskFactors).toContain('Workout completion rate dropped by 35%');
    });

    it('should return medium risk when a 14+ day streak was broken in last 7 days', () => {
      const result = AIDataAggregatorService.calculateChurnRisk(3, 0, 5, 14);
      expect(result.riskLevel).toBe('medium');
      expect(result.riskFactors).toContain('14-day streak broken 5 days ago');
    });

    it('should return low risk for regular active member', () => {
      const result = AIDataAggregatorService.calculateChurnRisk(2, 0);
      expect(result.riskLevel).toBe('low');
      expect(result.riskFactors).toContain('Consistent attendance pattern');
    });
  });
});
