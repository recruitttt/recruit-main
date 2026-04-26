type SseController = {
  enqueue(chunk: Uint8Array): void;
  close(): void;
};

export function createSseWriter(
  controller: SseController,
  encoder = new TextEncoder()
) {
  let closed = false;

  return {
    get closed() {
      return closed;
    },
    send(data: unknown): boolean {
      if (closed) return false;
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        return true;
      } catch {
        closed = true;
        return false;
      }
    },
    close(): void {
      if (closed) return;
      closed = true;
      try {
        controller.close();
      } catch {
        // The client may already have disconnected. Treat close as idempotent.
      }
    },
    cancel(): void {
      closed = true;
    },
  };
}
