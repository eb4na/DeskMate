/**
 * remove.bg background removal for generated companion sprites.
 * @see https://www.remove.bg/api
 */
export type RemoveBackgroundOptions = {
  /** person = standing character only; graphics = illustration with props */
  type?: 'auto' | 'person' | 'graphics' | 'product';
};

export async function removeBackgroundFromImage(
  imageBytes: Uint8Array,
  apiKey: string | undefined,
  options: RemoveBackgroundOptions = {},
): Promise<Uint8Array> {
  if (!apiKey) {
    return imageBytes;
  }

  const type = options.type ?? 'person';

  const formData = new FormData();
  formData.append('image_file', new Blob([imageBytes], { type: 'image/png' }), 'companion.png');
  formData.append('size', 'auto');
  formData.append('format', 'png');
  formData.append('type', type);
  formData.append('semitransparency', 'true');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: formData,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`remove.bg failed (${response.status}): ${details.slice(0, 300)}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}
