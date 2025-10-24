import { ConversionOptions, ConversionResult } from './types/converter-options';

export class Converter {
  async convertAllPosts(exportPath: string, outputDir: string, options?: ConversionOptions): Promise<ConversionResult> {
    throw new Error('Not implemented');
  }
}
