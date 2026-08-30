import { Injectable } from '@nestjs/common';
import {
  PerformanceCriterionScore,
  PerformanceCriterion,
} from '@prisma/client';

@Injectable()
export class RatingEngineService {
  calculateWeightedScore(
    scores: (PerformanceCriterionScore & { criterion: PerformanceCriterion })[],
    roleType: 'self' | 'manager' | 'hr',
  ): number {
    if (scores.length === 0) return 0.0;

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const s of scores) {
      const weight = s.criterion?.weight || 1.0;
      let rating = 0;
      if (roleType === 'self') rating = s.selfScore;
      else if (roleType === 'manager') rating = s.managerScore;
      else rating = s.hrScore;

      totalWeightedScore += rating * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return 0.0;
    const finalScore = totalWeightedScore / totalWeight;

    // Return rounded to nearest half point or 1 decimal place (let's do 1 decimal place, e.g. 4.3)
    return Math.round(finalScore * 10) / 10;
  }

  getRatingLabel(score: number): string {
    if (score >= 4.8) return 'Outstanding';
    if (score >= 4.3) return 'Excellent';
    if (score >= 3.8) return 'Very Good';
    if (score >= 3.3) return 'Good';
    if (score >= 2.8) return 'Meets Expectations';
    if (score >= 2.3) return 'Needs Improvement';
    if (score >= 1.8) return 'Poor';
    return 'Unsatisfactory';
  }
}
