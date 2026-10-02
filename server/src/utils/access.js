import HttpError from './HttpError.js';

export function scopedWardId(user, requestedWardId) {
  if (user.role === 'ulb_admin') return requestedWardId;
  if (!user.wardId) throw new HttpError(403, 'Your account is not assigned to a ward.');
  if (requestedWardId && Number(requestedWardId) !== user.wardId) {
    throw new HttpError(403, 'You can only access data in your own ward.');
  }
  return user.wardId;
}