import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import { LocalFile } from './api';

/** Longest side sent to the server. Keeps each upload well under the 2 MB PHP limit and quick on mobile data. */
const MAX_SIDE = 1600;

async function shrink(asset: ImagePicker.ImagePickerAsset, index: number): Promise<LocalFile> {
  const landscape = asset.width >= asset.height;
  const needsResize = Math.max(asset.width, asset.height) > MAX_SIDE;

  const ctx = ImageManipulator.manipulate(asset.uri);
  if (needsResize) ctx.resize(landscape ? { width: MAX_SIDE } : { height: MAX_SIDE });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });

  return { uri: saved.uri, name: `photo-${Date.now()}-${index}.jpg`, type: 'image/jpeg' };
}

function denied(what: string) {
  const msg = `Allow ${what} access for Property Basket in your phone's settings to add photos.`;
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(msg);
  } else {
    Alert.alert('Permission needed', msg);
  }
}

/** Take one photo with the camera. Returns [] if cancelled or not allowed. */
export async function takePhoto(): Promise<LocalFile[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    denied('camera');
    return [];
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  if (res.canceled) return [];
  return Promise.all(res.assets.map(shrink));
}

/** Choose photos from the phone's gallery. Returns [] if cancelled. */
export async function pickPhotos(multiple: boolean): Promise<LocalFile[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? 10 : 1,
  });
  if (res.canceled) return [];
  return Promise.all(res.assets.map(shrink));
}
