import { UniqueConstraintError, ValidationError } from 'sequelize';
import HttpError from '../utils/HttpError.js';

export function notFound(_request, response) {
  response.status(404).json({ error: { message: 'Route not found.' } });
}

export function errorHandler(error, _request, response, _next) {
  let status = error.status || error.statusCode || 500;
  let message = error.message || 'An unexpected error occurred.';
  let details = error.details;

  if (error instanceof UniqueConstraintError) {
    status = 409;
    message = 'A record with those unique values already exists.';
  } else if (error instanceof ValidationError) {
    status = 422;
    message = 'The submitted data is invalid.';
    details = error.errors.map((item) => ({ field: item.path, message: item.message }));
  } else if (error instanceof SyntaxError && 'body' in error) {
    status = 400;
    message = 'Request body must contain valid JSON.';
  }

  response.status(status).json({
    error: {
      message: status >= 500 && process.env.NODE_ENV === 'production'
        ? 'An unexpected server error occurred.'
        : message,
      ...(details ? { details } : {}),
    },
  });
}