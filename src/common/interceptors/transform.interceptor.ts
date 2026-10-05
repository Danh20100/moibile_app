import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseFormat<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ResponseFormat<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ResponseFormat<T> | T> {
    if (context.switchToHttp().getResponse<{ statusCode: number }>().statusCode === 204) {
      return next.handle();
    }
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
