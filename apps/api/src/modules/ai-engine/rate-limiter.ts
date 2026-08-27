import { Logger } from '@nestjs/common';

/**
 * Serialises calls to one provider so a burst cannot exceed its per-minute quota.
 *
 * The pipeline fans out — a job per page, a job per question — so several workers
 * reach the model at the same moment. Free tiers count requests per minute, not
 * per worker, which is why concurrency alone cannot be the control.
 *
 * Requests queue in arrival order and leave at a fixed spacing. A provider that
 * replies 429 with a retry hint parks the queue for that long instead of letting
 * every waiting caller burn an attempt against a quota that is already spent.
 */
export class RateLimiter {
  private readonly logger = new Logger(RateLimiter.name);
  private readonly minSpacingMs: number;
  private chain: Promise<unknown> = Promise.resolve();
  private nextSlotAt = 0;
  private pausedUntil = 0;

  constructor(
    private readonly name: string,
    requestsPerMinute: number,
  ) {
    this.minSpacingMs = requestsPerMinute > 0 ? 60_000 / requestsPerMinute : 0;
  }

  /** Runs `task` once a slot is free. Resolves with whatever the task returns. */
  run<T>(task: () => Promise<T>): Promise<T> {
    const queued = this.chain.then(async () => {
      await this.waitForSlot();
      return task();
    });

    // Keep the chain alive even when a task rejects, or one failure would stall
    // every request queued behind it.
    this.chain = queued.catch(() => undefined);
    return queued;
  }

  /** Parks the queue after a 429, so waiting callers do not spend the same quota. */
  pauseFor(ms: number) {
    const until = Date.now() + ms;
    if (until <= this.pausedUntil) return;
    this.pausedUntil = until;
    this.logger.warn(`${this.name}: rate limited, pausing ${Math.ceil(ms / 1000)}s`);
  }

  private async waitForSlot() {
    const now = Date.now();
    const readyAt = Math.max(now, this.nextSlotAt, this.pausedUntil);
    this.nextSlotAt = readyAt + this.minSpacingMs;
    if (readyAt > now) await sleep(readyAt - now);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
