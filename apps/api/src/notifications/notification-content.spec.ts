import { buildGenericMessage } from './notification-content';

describe('buildGenericMessage', () => {
  it('embeds only the order id — no other order detail, per the brief\'s content policy', () => {
    expect(buildGenericMessage('abc-123')).toBe('تحديث جديد على طلبك رقم #abc-123، تفضل بالدخول');
  });

  it('is a fixed template — identical output regardless of which event triggered it', () => {
    const orderId = 'xyz-789';
    expect(buildGenericMessage(orderId)).toBe(buildGenericMessage(orderId));
  });
});
