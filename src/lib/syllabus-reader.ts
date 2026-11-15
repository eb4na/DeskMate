// JS side of the syllabus importer's file reading. Everything native here is
// loaded LAZILY (requireOptionalNativeModule / require at call time) so an app
// binary built before these modules existed still boots — it just reports that
// upload isn't available and the paste option keeps working (see AGENTS.md).

import { requireOptionalNativeModule } from 'expo-modules-core';

type ReaderModule = {
  extractPdfText(uri: string): Promise<string>;
  recognizeImageText(uri: string): Promise<string>;
};

function reader(): ReaderModule | null {
  try {
    return requireOptionalNativeModule<ReaderModule>('SyllabusReader');
  } catch {
    return null;
  }
}

/** True when this build can read PDFs and photos (needs the native rebuild). */
export function canReadFiles(): boolean {
  if (!reader()) return false;
  try {
    require('expo-document-picker');
    require('expo-image-picker');
    return true;
  } catch {
    return false;
  }
}

/** Ask for a PDF, return its text. null = cancelled. */
export async function pickPdfText(): Promise<string | null> {
  const r = reader();
  if (!r) throw new Error('unavailable');
  const DocumentPicker = require('expo-document-picker') as typeof import('expo-document-picker');
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  return r.extractPdfText(res.assets[0].uri);
}

/** Take or choose a photo of a syllabus, return the text recognised in it. null = cancelled. */
export async function pickPhotoText(source: 'camera' | 'library'): Promise<string | null> {
  const r = reader();
  if (!r) throw new Error('unavailable');
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('camera-denied');
  }
  const opts = { mediaTypes: ['images'] as const, quality: 1, allowsEditing: false };
  const res = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ ...opts, mediaTypes: ['images'] })
    : await ImagePicker.launchImageLibraryAsync({ ...opts, mediaTypes: ['images'] });
  if (res.canceled || !res.assets?.[0]) return null;
  return r.recognizeImageText(res.assets[0].uri);
}
