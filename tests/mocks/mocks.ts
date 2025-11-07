import { EventEmitter } from 'events';
import { vi } from 'vitest';

/**
 * Create a mock HTTP response object (IncomingMessage)
 * Uses EventEmitter so emit() and on() actually work for testing error handlers
 * @param statusCode HTTP status code
 * @param headers Response headers object
 * @returns Mock response with statusCode, headers, and event emitting
 */
export function createMockResponse(statusCode = 200, headers = {}) {
  const emitter = new EventEmitter();
  return {
    statusCode,
    headers,
    pipe: vi.fn(),
    emit: (event: string, ...args: any[]) => emitter.emit(event, ...args),
    on: (event: string, listener: any) => emitter.on(event, listener),
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

/**
 * Create https.get mock implementation for simple HTTP status codes (4xx, 5xx)
 * @param statusCode HTTP status code to return
 * @returns Mock implementation function for https.get
 */
export function createSimpleStatusMock(statusCode: number) {
  return (_urlArg: any, _options: any, callback: any) => {
    const mockResponse = createMockResponse(statusCode);
    callback!(mockResponse);
    return createMockClientRequest();
  };
}

/**
 * Create https.get mock implementation for handling redirects (301/302)
 * @param statusCode Redirect status code (301 or 302)
 * @param initialUrl The initial URL being requested
 * @param redirectUrl The URL to redirect to
 * @param mockFileStream Mock file stream for successful response after redirect
 * @returns Mock implementation function for https.get
 */
export function createRedirectMock(
  statusCode: number,
  initialUrl: string,
  redirectUrl: string,
  mockFileStream: any
) {
  return (urlArg: any, _options: any, callback: any) => {
    if (urlArg === initialUrl) {
      const mockResponse = createMockResponse(statusCode, { location: redirectUrl });
      callback!(mockResponse);
    } else if (urlArg === redirectUrl) {
      const successResponse = createMockResponse(200);
      successResponse.pipe = vi.fn((dest: any) => {
        setTimeout(() => {
          mockFileStream.emit('finish');
        }, 10);
        return dest;
      });

      callback!(successResponse);
    }

    return createMockClientRequest();
  };
}

/**
 * Create https.get mock implementation for successful downloads (200 OK)
 * Handles both successful completion and stream errors
 * @param mockFileStream Mock file stream for download
 * @param eventType Event to emit on the stream: 'finish' for success or 'error' for failure
 * @param errorArg Error object to emit (required when eventType is 'error')
 * @returns Mock implementation function for https.get
 */
export function createSuccessDownloadMock(
  mockFileStream: any,
  eventType: 'finish' | 'error' = 'finish',
  errorArg?: Error
) {
  return (_urlArg: any, _options: any, callback: any) => {
    const mockResponse = createMockResponse(200);
    mockResponse.pipe = vi.fn((dest: any) => {
      setTimeout(() => {
        if (eventType === 'error' && errorArg) {
          mockFileStream.emit('error', errorArg);
        } else {
          mockFileStream.emit('finish');
        }
      }, 10);
      return eventType === 'error' ? mockFileStream : dest;
    });

    callback!(mockResponse);
    return createMockClientRequest();
  };
}

/**
 * Create https.get mock for redirect without location header
 * Simulates malformed redirect responses (missing location header)
 * @param statusCode Redirect status code (301 or 302)
 * @returns Mock implementation function for https.get
 */
export function createBadRedirectMock(statusCode: number) {
  return (_urlArg: any, _options: any, callback: any) => {
    const mockResponse = createMockResponse(statusCode, {});
    callback!(mockResponse);
    return createMockClientRequest();
  };
}

/**
 * Create https.get mock for response stream error
 * Simulates HTTP response that errors during streaming
 * @returns Mock implementation function for https.get
 */
export function createResponseStreamErrorMock() {
  return (_urlArg: any, _options: any, callback: any) => {
    const mockResponse = createMockResponse(200);
    mockResponse.pipe = vi.fn((dest: any) => {
      return dest;
    });

    callback!(mockResponse);

    setTimeout(() => {
      mockResponse.emit('error', new Error('Stream error occurred'));
    }, 5);

    return createMockClientRequest();
  };
}

/**
 * Create a mock WriteStream for Logger file writing
 * @returns Mock write stream with write, end, and on methods
 */
export function createMockWriteStream() {
  const emitter = new EventEmitter();
  return {
    write: vi.fn(),
    end: vi.fn((callback?: () => void) => {
      if (callback) callback();
    }),
    on: (event: string, listener: any) => {
      emitter.on(event, listener);
      return emitter as any;
    },
    emit: (event: string, ...args: any[]) => emitter.emit(event, ...args),
  } as any;
}

/**
 * Create mock console methods for Logger testing
 * @returns Object with mocked console methods
 */
export function createMockConsole() {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };
}

/**
 * Mock Date.now() with a fixed timestamp
 * @param fixedTime Fixed timestamp to return
 * @returns Cleanup function to restore Date.now()
 */
export function mockDateNow(fixedTime: number): () => void {
  const spy = vi.spyOn(Date, 'now').mockReturnValue(fixedTime);
  return () => spy.mockRestore();
}
