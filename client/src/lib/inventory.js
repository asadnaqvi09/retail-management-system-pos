export function formatVariantAttributes(attributes) {
  if (!attributes?.length) {
    return '—';
  }
  return attributes.map((item) => item.value).join(' / ');
}
