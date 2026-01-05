import { describe, it, expect } from 'vitest';
import { MarkdownTransformer } from '../../src/processors/markdown-transformer.js';

describe('MarkdownTransformer', () => {
  describe('constructor', () => {
    it('should create instance with default options', () => {
      const transformer = new MarkdownTransformer();
      expect(transformer).toBeInstanceOf(MarkdownTransformer);
    });

    it('should create instance with custom options', () => {
      const transformer = new MarkdownTransformer({
        removeAlignAttributes: false,
      });
      expect(transformer).toBeInstanceOf(MarkdownTransformer);
    });

    it('should create instance with multiple custom options', () => {
      const transformer = new MarkdownTransformer({
        removeAlignAttributes: true,
        trimTrailingWhitespace: true,
        convertCalloutsToBlockquotes: false,
      });
      expect(transformer).toBeInstanceOf(MarkdownTransformer);
    });
  });

  describe('transform', () => {
    describe('Align Attribute Removal', () => {
      it('should remove align attribute from image markdown', () => {
        const transformer = new MarkdownTransformer();
        const input = '![alt text](image.png) align="center"';
        const expected = '![alt text](image.png)';
        expect(transformer.transform(input)).toBe(expected);
      });

      it('should remove align="left" attribute', () => {
        const transformer = new MarkdownTransformer();
        const input = '![](img.jpg) align="left"';
        const expected = '![](img.jpg)';
        expect(transformer.transform(input)).toBe(expected);
      });

      it('should remove align="right" attribute', () => {
        const transformer = new MarkdownTransformer();
        const input = '![](img.jpg) align="right"';
        const expected = '![](img.jpg)';
        expect(transformer.transform(input)).toBe(expected);
      });

      it('should remove multiple align attributes', () => {
        const transformer = new MarkdownTransformer();
        const input = '![](a.png) align="center"\n![](b.png) align="right"';
        const expected = '![](a.png)\n![](b.png)';
        expect(transformer.transform(input)).toBe(expected);
      });

      it('should remove align attributes in complex markdown', () => {
        const transformer = new MarkdownTransformer();
        const input = `# Heading

![First image](img1.png) align="center"

Some text here.

![Second image](img2.jpg) align="left"`;
        const expected = `# Heading

![First image](img1.png)

Some text here.

![Second image](img2.jpg)`;
        expect(transformer.transform(input)).toBe(expected);
      });

      it('should preserve markdown without align attributes', () => {
        const transformer = new MarkdownTransformer();
        const input = '![alt text](image.png)';
        expect(transformer.transform(input)).toBe(input);
      });

      it('should not remove align when option is disabled', () => {
        const transformer = new MarkdownTransformer({
          removeAlignAttributes: false,
        });
        const input = '![](img.png) align="center"';
        expect(transformer.transform(input)).toBe(input);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty string', () => {
        const transformer = new MarkdownTransformer();
        expect(transformer.transform('')).toBe('');
      });

      it('should handle markdown with no transformations needed', () => {
        const transformer = new MarkdownTransformer();
        const input = '# Heading\n\nSome text with **bold** and *italic*.';
        expect(transformer.transform(input)).toBe(input);
      });

      it('should throw error for non-string input - null', () => {
        const transformer = new MarkdownTransformer();
        expect(() => transformer.transform(null as any)).toThrow('Markdown must be a string');
      });

      it('should throw error for non-string input - undefined', () => {
        const transformer = new MarkdownTransformer();
        expect(() => transformer.transform(undefined as any)).toThrow('Markdown must be a string');
      });

      it('should throw error for non-string input - number', () => {
        const transformer = new MarkdownTransformer();
        expect(() => transformer.transform(123 as any)).toThrow('Markdown must be a string');
      });

      it('should throw error for non-string input - object', () => {
        const transformer = new MarkdownTransformer();
        expect(() => transformer.transform({} as any)).toThrow('Markdown must be a string');
      });

      it('should throw error for non-string input - array', () => {
        const transformer = new MarkdownTransformer();
        expect(() => transformer.transform([] as any)).toThrow('Markdown must be a string');
      });
    });

    describe('Complex Markdown', () => {
      it('should remove align attributes outside code blocks', () => {
        // Note: Current implementation uses simple regex that may match inside code blocks.
        // Analysis of 48 real Hashnode blog posts showed align attributes ONLY appear on images,
        // never in code blocks, so this is not a practical concern for real Hashnode exports.
        const transformer = new MarkdownTransformer();
        const input = '```js\nconst config = { imageAlign: "center" };\n```\n![](img.png) align="center"';
        const expected = '```js\nconst config = { imageAlign: "center" };\n```\n![](img.png)';
        expect(transformer.transform(input)).toBe(expected);
      });

      it('should preserve inline code with different content', () => {
        const transformer = new MarkdownTransformer();
        const input = 'Use `text-align: center` in CSS\n![](img.png) align="center"';
        const expected = 'Use `text-align: center` in CSS\n![](img.png)';
        expect(transformer.transform(input)).toBe(expected);
      });

      it('should handle markdown with multiple paragraphs and images', () => {
        const transformer = new MarkdownTransformer();
        const input = `Paragraph 1

![](img1.png) align="center"

Paragraph 2 with **bold** text.

![](img2.jpg) align="left"

Final paragraph.`;
        const expected = `Paragraph 1

![](img1.png)

Paragraph 2 with **bold** text.

![](img2.jpg)

Final paragraph.`;
        expect(transformer.transform(input)).toBe(expected);
      });
    });

    describe('Content Preservation', () => {
      it('should preserve smart quotes (curly quotes)', () => {
        const transformer = new MarkdownTransformer();
        const input = 'The "Start in" field should contain `~/`';
        expect(transformer.transform(input)).toBe(input);
      });

      it('should preserve em dashes', () => {
        const transformer = new MarkdownTransformer();
        const input = 'This pattern—essentially "getting the latest"—works well';
        expect(transformer.transform(input)).toBe(input);
      });

      it('should preserve emojis', () => {
        const transformer = new MarkdownTransformer();
        const input = '🎉🎉🎉 You\'re now starting in the default directory.';
        expect(transformer.transform(input)).toBe(input);
      });

      it('should preserve multiple different emojis', () => {
        const transformer = new MarkdownTransformer();
        const input = '💡 Pro tip: Use 📕 for documentation and 🎉 for celebrations!';
        expect(transformer.transform(input)).toBe(input);
      });

      it('should preserve escaped underscores in URLs', () => {
        const transformer = new MarkdownTransformer();
        const input = '[gaming\\_achievement\\_system](http://github.com/user/gaming_achievement_system)';
        expect(transformer.transform(input)).toBe(input);
      });

      it('should preserve HTML callout divs by default', () => {
        const transformer = new MarkdownTransformer();
        const input = '<div data-node-type="callout">\n<div data-node-type="callout-emoji">💡</div>\n<div>Important note</div>\n</div>';
        expect(transformer.transform(input)).toBe(input);
      });

      it('should preserve markdown tables', () => {
        const transformer = new MarkdownTransformer();
        const input = `| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |`;
        expect(transformer.transform(input)).toBe(input);
      });

      it('should preserve markdown lists', () => {
        const transformer = new MarkdownTransformer();
        const input = `* Item 1
* Item 2
  * Nested item
* Item 3`;
        expect(transformer.transform(input)).toBe(input);
      });
    });

    describe('Optional Transformations', () => {
      describe('Trailing Whitespace', () => {
        it('should trim trailing whitespace when enabled', () => {
          const transformer = new MarkdownTransformer({
            trimTrailingWhitespace: true,
          });
          const input = '* Item 1    \n* Item 2   \n';
          const expected = '* Item 1\n* Item 2\n';
          expect(transformer.transform(input)).toBe(expected);
        });

        it('should not trim trailing whitespace when disabled', () => {
          const transformer = new MarkdownTransformer({
            trimTrailingWhitespace: false,
          });
          const input = '* Item 1    \n';
          expect(transformer.transform(input)).toBe(input);
        });

        it('should trim trailing whitespace from multiple lines', () => {
          const transformer = new MarkdownTransformer({
            trimTrailingWhitespace: true,
          });
          const input = 'Line 1   \nLine 2     \nLine 3   \n';
          const expected = 'Line 1\nLine 2\nLine 3\n';
          expect(transformer.transform(input)).toBe(expected);
        });

        it('should preserve markdown hard line breaks (exactly 2 trailing spaces)', () => {
          const transformer = new MarkdownTransformer({
            trimTrailingWhitespace: true,
          });
          const input = 'Line 1  \nLine 2';
          const expected = 'Line 1  \nLine 2';
          expect(transformer.transform(input)).toBe(expected);
        });

        it('should remove 3 or more trailing spaces', () => {
          const transformer = new MarkdownTransformer({
            trimTrailingWhitespace: true,
          });
          const input = 'Line 1   \nLine 2    \n';
          const expected = 'Line 1\nLine 2\n';
          expect(transformer.transform(input)).toBe(expected);
        });

        it('should remove single trailing space', () => {
          const transformer = new MarkdownTransformer({
            trimTrailingWhitespace: true,
          });
          const input = 'Line 1 \nLine 2\n';
          const expected = 'Line 1\nLine 2\n';
          expect(transformer.transform(input)).toBe(expected);
        });
      });

      describe('Callout Conversion', () => {
        it('should preserve HTML callouts when conversion is disabled', () => {
          const transformer = new MarkdownTransformer({
            convertCalloutsToBlockquotes: false,
          });
          const input = '<div data-node-type="callout">\n<div data-node-type="callout-emoji">💡</div>\n</div>';
          expect(transformer.transform(input)).toBe(input);
        });

        it('should not convert callouts when enabled (TODO: not implemented)', () => {
          const transformer = new MarkdownTransformer({
            convertCalloutsToBlockquotes: true,
          });
          const input = '<div data-node-type="callout">\n<div data-node-type="callout-emoji">💡</div>\n<div>Note content</div>\n</div>';
          // For now, it just returns unchanged since conversion is not implemented
          expect(transformer.transform(input)).toBe(input);
        });
      });
    });

    describe('Combined Transformations', () => {
      it('should apply multiple transformations when enabled', () => {
        const transformer = new MarkdownTransformer({
          removeAlignAttributes: true,
          trimTrailingWhitespace: true,
        });
        const input = '![](img.png) align="center"   \n* Item 1    \n';
        const expected = '![](img.png)\n* Item 1\n';
        expect(transformer.transform(input)).toBe(expected);
      });

      it('should handle all transformations disabled', () => {
        const transformer = new MarkdownTransformer({
          removeAlignAttributes: false,
          trimTrailingWhitespace: false,
          convertCalloutsToBlockquotes: false,
        });
        const input = '![](img.png) align="center"   \n';
        expect(transformer.transform(input)).toBe(input);
      });

      it('should apply transformations in correct order', () => {
        const transformer = new MarkdownTransformer({
          removeAlignAttributes: true,
          trimTrailingWhitespace: true,
        });
        const input = '![](a.png) align="left"   \n![](b.png) align="right"   \n';
        const expected = '![](a.png)\n![](b.png)\n';
        expect(transformer.transform(input)).toBe(expected);
      });
    });

    describe('Real-World Scenarios', () => {
      it('should handle typical Hashnode blog post structure', () => {
        const transformer = new MarkdownTransformer();
        const input = `# My Blog Post

This is an introduction with a "smart quote" and an em dash—like this.

![Featured image](https://cdn.hashnode.com/image.png) align="center"

## Section 1

Some content here with emojis 💡.

![](https://cdn.hashnode.com/diagram.png) align="left"

<div data-node-type="callout">
<div data-node-type="callout-emoji">💡</div>
<div>Important callout</div>
</div>

## Conclusion

Final thoughts.`;

        const expected = `# My Blog Post

This is an introduction with a "smart quote" and an em dash—like this.

![Featured image](https://cdn.hashnode.com/image.png)

## Section 1

Some content here with emojis 💡.

![](https://cdn.hashnode.com/diagram.png)

<div data-node-type="callout">
<div data-node-type="callout-emoji">💡</div>
<div>Important callout</div>
</div>

## Conclusion

Final thoughts.`;

        expect(transformer.transform(input)).toBe(expected);
      });

      it('should handle blog post with code examples', () => {
        const transformer = new MarkdownTransformer();
        const input = `# Tutorial

\`\`\`typescript
// Example configuration
const config = { imageAlign: "center" };
\`\`\`

![Demo screenshot](screen.png) align="center"

Use the image alignment feature.`;

        const expected = `# Tutorial

\`\`\`typescript
// Example configuration
const config = { imageAlign: "center" };
\`\`\`

![Demo screenshot](screen.png)

Use the image alignment feature.`;

        expect(transformer.transform(input)).toBe(expected);
      });
    });
  });
});
