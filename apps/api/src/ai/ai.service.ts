import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';

export type AdvisoryResult = { score: number; explanation: string; modelVersion: string };

/**
 * Thin proxy to the FastAPI advisory AI service (apps/ai-service). Clients
 * send the photo as base64 JSON; the photo itself is forwarded upstream as
 * multipart. Scores are advisory only — they never gate a state transition.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly baseUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8001';

  async health(): Promise<{ status: string; detail: unknown }> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      return { status: res.ok ? 'ok' : 'unreachable', detail: await res.json().catch(() => null) };
    } catch (error) {
      return { status: 'unreachable', detail: (error as Error).message };
    }
  }

  async grade(photoBase64: string): Promise<AdvisoryResult> {
    if (typeof photoBase64 !== 'string' || photoBase64.length === 0) {
      throw new BadRequestException('photoBase64 is required');
    }
    const bytes = Buffer.from(photoBase64, 'base64');
    if (bytes.length === 0) {
      throw new BadRequestException('photoBase64 did not decode to any bytes');
    }
    const form = new FormData();
    form.append('photo', new Blob([new Uint8Array(bytes)]), 'photo.jpg');
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/grade`, { method: 'POST', body: form });
    } catch (error) {
      this.logger.warn(`AI service unreachable: ${(error as Error).message}`);
      throw new BadGatewayException('AI service is unreachable — is apps/ai-service running?');
    }
    if (!res.ok) {
      throw new BadGatewayException(`AI service error (HTTP ${res.status})`);
    }
    return (await res.json()) as AdvisoryResult;
  }
}
