export class Logger {
  private logFilePath: string;

  constructor(logFilePath?: string) {
    this.logFilePath = logFilePath || '';
  }

  info(_message: string): void {}
  close(): Promise<void> {
    return Promise.resolve();
  }
}
