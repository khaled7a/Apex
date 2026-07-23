import { isAdminActionableState } from '@apex/domain';
import { ADMIN_QUEUE_CATEGORY } from './admin-queue-category.const';

describe('ADMIN_QUEUE_CATEGORY', () => {
  it('every key is a real admin-actionable state per packages/domain — prevents the cosmetic dashboard grouping from drifting away from the actual transition table', () => {
    for (const state of Object.keys(ADMIN_QUEUE_CATEGORY)) {
      expect(isAdminActionableState(state as never)).toBe(true);
    }
  });
});
