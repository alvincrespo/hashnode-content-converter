import { EventEmitter } from 'events';
import { vi } from 'vitest';

/**
 * Create a mock HTTP response object (IncomingMessage)
 * @param statusCode HTTP status code
 * @param headers Response headers object
 * @returns Mock response object with statusCode and headers
 */
export function createMockResponse(statusCode = 200, headers = {}) {
  return {
    statusCode,
    headers,
    pipe: vi.fn(),
    on: vi.fn(),
  } as any;
}

/**
 * Create a mock file stream object (WriteStream)
 * Uses EventEmitter so emit() actually triggers listeners during tests
 * @returns Mock stream with emit, on, close, and destroy methods
 */
export function createMockFileStream() {
  const emitter = new EventEmitter();
  return {
    emit: (event: string, ...args: any[]) => emitter.emit(event, ...args),
    on: (event: string, listener: any) => emitter.on(event, listener),
    close: vi.fn(),
    destroy: vi.fn(),
  } as any;
}

/**
 * Create a mock ClientRequest object (https.get() return value)
 * @returns Mock request with on and destroy methods
 */
export function createMockClientRequest() {
  return {
    on: vi.fn(),
    destroy: vi.fn(),
  } as any;
}
