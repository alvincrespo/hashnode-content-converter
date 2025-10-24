export interface ConversionOptions {
  skipExisting?: boolean;
  downloadDelayMs?: number;
}

export interface ConversionError {
  slug: string;
  error: string;
}

export interface ConversionResult {
  converted: number;
  skipped: number;
  errors: ConversionError[];
  duration: string;
}
