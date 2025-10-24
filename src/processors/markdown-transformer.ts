export class MarkdownTransformer {
  transform(markdown: string): string {
    return markdown.replace(/ align="[^"]*"/g, '');
  }
}
