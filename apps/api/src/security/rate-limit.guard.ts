import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

type RequestLike = {
  ip?: string;
  socket?: { remoteAddress?: string };
  method?: string;
  path?: string;
};

type WindowEntry = { startedAt: number; count: number };

/** Small dependency-free limiter for the pilot API; use an edge limiter in production too. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, WindowEntry>();
  private readonly limit = Math.max(1, Number(process.env.RATE_LIMIT_REQUESTS ?? 120));
  private readonly windowMs = Math.max(1_000, Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000));

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const key = `${request.ip ?? request.socket?.remoteAddress ?? 'unknown'}:${request.method ?? 'GET'}:${request.path ?? ''}`;
    const now = Date.now();
    const current = this.windows.get(key);
    if (!current || now - current.startedAt >= this.windowMs) {
      this.windows.set(key, { startedAt: now, count: 1 });
      return true;
    }
    if (current.count >= this.limit) {
      throw new HttpException('Too many requests; retry shortly', HttpStatus.TOO_MANY_REQUESTS);
    }
    current.count += 1;
    return true;
  }
}
