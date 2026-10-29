import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorMessage = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorMessage = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as any;
        if (Array.isArray(resp.message)) {
          errorMessage = resp.message.join(', ');
        } else if (resp.message) {
          errorMessage = resp.message;
        } else if (resp.error) {
          errorMessage = resp.error;
        }
      }
    } else if (exception?.message) {
      errorMessage = exception.message;
    }

    // Retorna estrictamente el formato del contrato fintech: {"error": "mensaje"}
    response.status(status).json({
      error: errorMessage,
    });
  }
}
