import { submitRating, workerOwnSummary, workerScorecards } from '../services/ratingService.js';
import { scopedWardId } from '../utils/access.js';

export async function ratePickup(request, response) {
  const rating = await submitRating({
    qrCode: request.body.qrCode,
    phoneLast4: request.body.phoneLast4,
    pickupLogId: Number(request.body.pickupLogId),
    stars: Number(request.body.stars),
    comment: request.body.comment,
  });
  response.status(201).json({ rating });
}

export async function myRatings(request, response) {
  response.json(await workerOwnSummary(request.user.id));
}

export async function listScorecards(request, response) {
  const wardId = scopedWardId(request.user, request.query.wardId);
  response.json({ workers: await workerScorecards({ wardId }) });
}