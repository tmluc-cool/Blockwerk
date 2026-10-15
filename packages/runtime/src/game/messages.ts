import type { GameObject } from '../world/GameObject';

/** Who receives a message. */
export type MessageTarget =
  | { readonly kind: 'all' }
  | { readonly kind: 'tag'; readonly tag: string }
  | { readonly kind: 'object'; readonly object: GameObject };

/** A message waiting for delivery. */
export interface QueuedMessage {
  readonly message: string;
  readonly target: MessageTarget;
  readonly sender: GameObject | null;
}

/**
 * Messages between objects (SPEC Appendix A: "send message … to …", "When I receive message …").
 * Sending only queues the message; the game delivers the queue at the start of the next logic
 * tick (after input and timers, before the components), so the order does not depend on which
 * script ran first.
 */
export class MessageBus {
  private queue: QueuedMessage[] = [];

  /** Queues a message. Empty messages are ignored. */
  send(message: string, target: MessageTarget, sender: GameObject | null = null): void {
    if (message === '') return;
    this.queue.push({ message, target, sender });
  }

  /** Takes all queued messages. */
  take(): QueuedMessage[] {
    const taken = this.queue;
    this.queue = [];
    return taken;
  }
}
