import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

/**
 * Push notifications (due calendar reminders, new leads).
 *
 * The server sends through Expo's push service to the token we register here.
 * Push needs a real device and an EAS project id (set when the app is linked
 * to an Expo account with `eas init`); until then registration is skipped
 * quietly and the app works without push. Expo Go on Android can't receive
 * push since SDK 53, so test it on a development or preview build.
 */

let registeredToken: string | null = null;

if (Platform.OS !== 'web') {
  // Show the banner even when the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function projectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/** Ask permission, get this device's Expo token and send it to the API. Never throws. */
export async function registerForPush(): Promise<void> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;
    const id = projectId();
    if (!id) return; // not linked to EAS yet

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Reminders and leads',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#F26A1B',
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await api.post('/push-tokens', { token, platform: Platform.OS });
    registeredToken = token;
  } catch {
    // Push is optional — never block sign-in on it.
  }
}

/** Stop pushes to this device for the signed-in user (call before logout). */
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  try {
    await api.del('/push-tokens', { token: registeredToken });
  } catch {
    // ignore
  }
  registeredToken = null;
}

export type PushData =
  | { type: 'reminder'; reminder_id: number; date: string }
  | { type: 'lead'; inquiry_id: number };

/** Calls `onOpen` when the user taps a notification (also for the one that launched the app). */
export function onPushOpened(onOpen: (data: PushData) => void): () => void {
  if (Platform.OS === 'web') return () => {};

  const handle = (r: Notifications.NotificationResponse | null) => {
    const data = r?.notification.request.content.data as PushData | undefined;
    if (data?.type) onOpen(data);
  };

  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
