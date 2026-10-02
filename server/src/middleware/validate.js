import { validationResult } from 'express-validator';

export async function collectValidationErrors(request, validations) {
  for (const validation of validations) {
    await validation.run(request);
  }

  return validationResult(request).array().map((error) => ({
    field: error.path || error.param,
    location: error.location,
    message: error.msg,
  }));
}

export function validate(...validations) {
  return async (request, response, next) => {
    const details = await collectValidationErrors(request, validations);
    if (details.length) {
      response.status(422).json({ error: { message: 'Validation failed.', details } });
      return;
    }
    next();
  };
}