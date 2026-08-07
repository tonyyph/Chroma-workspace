import { useLastNotificationResponse } from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

/**
 * Sends a tapped notification where its payload says to go.
 *
 * **Why this exists.** `ExpoNotificationScheduler` has always attached a route to
 * the daily reminder, and nothing in the app has ever read it — there was no
 * response listener anywhere in the source. So tapping "A moment is waiting in
 * color" opened the app to whatever screen it happened to be left on, which is
 * the one place the reminder is not asking anyone to go. The payload also named
 * `/(tabs)/capture`, a route that does not exist; capture is a modal on the root
 * stack.
 *
 * `useLastNotificationResponse` rather than `addNotificationResponseReceivedListener`
 * because a subscription only fires while the app is already running. The whole
 * job of a daily reminder is to reach someone who has the app closed, and that
 * is a cold start — which this hook reports and a subscription misses.
 */

/** Routes a notification is allowed to open. An allowlist, so a malformed or
 *  stale payload cannot navigate the app somewhere arbitrary. */
const ROUTES = ['/capture'] as const;
type NotificationRoute = (typeof ROUTES)[number];

function routeOf(data: unknown): NotificationRoute | null {
  if (typeof data !== 'object' || data === null || !('route' in data)) return null;
  const { route } = data;
  // `String` rather than a cast: the payload crosses a native boundary as
  // untyped JSON, so it is genuinely unknown until it matches something.
  const value = String(route);
  return ROUTES.find((entry) => entry === value) ?? null;
}

export function useNotificationRoute(): void {
  const response = useLastNotificationResponse();
  const router = useRouter();
  /**
   * The hook keeps returning the same response for the life of the process, so
   * without this a re-render would navigate again — and on a cold start that
   * would fire once for the launch and once more for every state change after.
   */
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;

    const { identifier } = response.notification.request;
    if (handled.current === identifier) return;
    handled.current = identifier;

    const route = routeOf(response.notification.request.content.data);
    if (route) router.push(route);
  }, [response, router]);
}
