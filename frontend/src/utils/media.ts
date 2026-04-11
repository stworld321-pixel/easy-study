export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'm4v'];

export const isVideoUrl = (url?: string | null) => {
  if (!url) return false;
  return new RegExp(`\\.(${VIDEO_EXTENSIONS.join('|')})(\\?.*)?$`, 'i').test(url);
};
