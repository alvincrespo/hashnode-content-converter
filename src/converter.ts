import { ConversionOptions } from './types/converter-options';
import { ConversionResult } from './types/conversion-result';

export class Converter {
  async convertAllPosts(_exportPath: string, _outputDir: string, _options?: ConversionOptions): Promise<ConversionResult> {
    throw new Error('Not implemented');
  }
}
