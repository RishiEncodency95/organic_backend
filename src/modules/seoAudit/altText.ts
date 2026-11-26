/**
 * An alt text that says nothing about the picture: nothing, a word or two such as "image", "icon" or "logo", a file name
 * ("IMG_0042.jpg") or an empty label. "Ambulance icon" or "Temple icon" is NOT generic: it says what the picture shows.
 */
export const isGenericAlt = (alt: string | null | undefined): boolean => {
  const a = (alt ?? "").trim();
  if (a.length < 4) return true;
  if (/^(image|images|banner|photo|pic|picture|icon|icons|logo|arrow|btn|button|svg|img|graphic|thumbnail|untitled)([\s_-]*\d+)?$/i.test(a)) return true;
  if (/^[\w-]+\.(png|jpe?g|webp|gif|svg|avif)$/i.test(a)) return true;
  return false;
};
