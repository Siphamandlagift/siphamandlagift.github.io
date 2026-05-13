import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

type ValidationSchema = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

export function validateRequest(schema: ValidationSchema): RequestHandler {
  return async (request, _response, next) => {
    try {
      if (schema.body) {
        request.body = await schema.body.parseAsync(request.body);
      }

      if (schema.params) {
        request.params = await schema.params.parseAsync(request.params) as typeof request.params;
      }

      if (schema.query) {
        request.query = await schema.query.parseAsync(request.query) as typeof request.query;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}