import { ConversionOptions } from './types/converter-options';
import { ConversionResult } from './types/conversion-result';

export class Converter {
  async convertAllPosts(exportPath: string, outputDir: string, options?: ConversionOptions): Promise<ConversionResult> {
    throw new Error('Not implemented');
  }
}
