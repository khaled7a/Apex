import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { StaleStateError, TransitionRejectedError } from './transition-engine.errors';

/**
 * Maps the two domain errors TransitionEngineService throws to the HTTP
 * status codes a client should actually branch on, instead of a generic 500:
 * a stale optimistic-lock version is a conflict (409, safe to retry after
 * re-fetching state), a rejected transition (unknown/forbidden/guard-failed)
 * is a semantic validation failure (422), never a server bug.
 */
@Catch(StaleStateError, TransitionRejectedError)
export class TransitionExceptionFilter implements ExceptionFilter {
  catch(exception: StaleStateError | TransitionRejectedError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof StaleStateError) {
      response.status(409).json({
        statusCode: 409,
        error: 'StaleState',
        message: exception.message,
        actualState: exception.actualState,
        actualVersion: exception.actualVersion,
      });
      return;
    }

    response.status(422).json({
      statusCode: 422,
      error: 'TransitionRejected',
      message: exception.message,
      reason: exception.reason,
      detail: exception.detail,
    });
  }
}
