import { renderHook } from '@testing-library/react-native';
import { useLastNotificationResponse } from 'expo-notifications';
import { useNotificationRoute } from './useNotificationRoute';

const push = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush() }) }));

/** `jest.mock` factories may only close over names beginning `mock`. */
const mockPush = () => push;

const asMock = jest.mocked(useLastNotificationResponse);

/** The shape `useLastNotificationResponse` returns, trimmed to what is read. */
const response = (identifier: string, data: unknown) =>
  ({
    notification: { request: { identifier, content: { data } } },
  }) as unknown as ReturnType<typeof useLastNotificationResponse>;

/**
 * The reminder carried a route for the whole of v3 and nothing read it, so the
 * regression these guard against is silence: a notification that opens the app
 * and does nothing looks exactly like a notification that works.
 */
describe('useNotificationRoute', () => {
  beforeEach(() => {
    push.mockReset();
    asMock.mockReset().mockReturnValue(null);
  });

  it('does nothing when the app was opened from the icon', () => {
    renderHook(() => useNotificationRoute());
    expect(push).not.toHaveBeenCalled();
  });

  it('opens the route the reminder asks for', () => {
    asMock.mockReturnValue(response('reminder-1', { route: '/capture' }));
    renderHook(() => useNotificationRoute());
    expect(push).toHaveBeenCalledWith('/capture');
  });

  it('navigates once however often the hook re-runs', () => {
    asMock.mockReturnValue(response('reminder-1', { route: '/capture' }));
    const { rerender } = renderHook(() => useNotificationRoute());
    rerender({});
    rerender({});
    // The response persists for the life of the process, so re-renders must not
    // keep pushing capture onto the stack.
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('ignores a route that is not on the allowlist', () => {
    asMock.mockReturnValue(response('reminder-2', { route: '/paywall' }));
    renderHook(() => useNotificationRoute());
    expect(push).not.toHaveBeenCalled();
  });

  it('ignores the stale payload that named a route which never existed', () => {
    // Shipped builds scheduled this string; their reminders are still pending.
    asMock.mockReturnValue(response('reminder-3', { route: '/(tabs)/capture' }));
    renderHook(() => useNotificationRoute());
    expect(push).not.toHaveBeenCalled();
  });

  it('survives a payload with no route at all', () => {
    asMock.mockReturnValue(response('reminder-4', undefined));
    expect(() => renderHook(() => useNotificationRoute())).not.toThrow();
    expect(push).not.toHaveBeenCalled();
  });
});
