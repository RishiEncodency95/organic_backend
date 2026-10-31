import { ApiError } from '../../utils/ApiError';

type Message = string | { message: string; reason?: string };
export class HttpException extends ApiError {
  readonly reason?: string;
  readonly status: number;
  constructor(value: Message, status: number) {
    super(status, typeof value === 'string' ? value : value.message);
    this.status = status;
    this.reason = typeof value === 'string' ? undefined : value.reason;
  }
}
export class BadRequestException extends HttpException { constructor(m: Message) { super(m, 400); } }
export class ForbiddenException extends HttpException { constructor(m: Message) { super(m, 403); } }
export class NotFoundException extends HttpException { constructor(m: Message) { super(m, 404); } }
export class ConflictException extends HttpException { constructor(m: Message) { super(m, 409); } }
export class GoneException extends HttpException { constructor(m: Message) { super(m, 410); } }
export class ServiceUnavailableException extends HttpException { constructor(m: Message) { super(m, 503); } }
export const HttpStatus = { TOO_MANY_REQUESTS: 429 };
import { logger as organicLogger } from '../../utils/logger';
const write = (level: 'info' | 'warn' | 'error', value: unknown) => organicLogger[level](typeof value === 'string' ? value : { message: (value as { msg?: string; event?: string })?.msg ?? (value as { event?: string })?.event ?? 'analyzer', ...(value as object) });
export const logger = { log: (value: unknown) => write('info', value), info: (value: unknown) => write('info', value), warn: (value: unknown) => write('warn', value), error: (value: unknown) => write('error', value) };
