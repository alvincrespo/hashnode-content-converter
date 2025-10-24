const fs = require('fs');
const path = require('path');
const https = require('https');

// Constants
const IMAGE_DOWNLOAD_DELAY_MS = 200;

// Logger class for dual output (console + file)
class Logger {
  constructor(logFilePath) {
    this.logFilePath = logFilePath || this.generateLogFileName();
    this.fileStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
    this.http403Errors = [];
    this.startTime = new Date();
  }

  generateLogFileName() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return path.join(process.cwd(), `conversion-${timestamp}.log`);
  }

  getTimestamp() {
    return new Date().toLocaleTimeString();
  }

  getDuration() {
    const elapsed = new Date() - this.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  info(message) {
    const timestamp = this.getTimestamp();
    const logLine = `[${timestamp}] INFO  | ${message}`;
    console.log(message);
    this.fileStream.write(logLine + '\n');
  }

  success(message) {
    const timestamp = this.getTimestamp();
    const logLine = `[${timestamp}] SUCCESS | ${message}`;
    console.log(message);
    this.fileStream.write(logLine + '\n');
  }

  warn(message) {
    const timestamp = this.getTimestamp();
    const logLine = `[${timestamp}] WARN  | ${message}`;
    console.warn(message);
    this.fileStream.write(logLine + '\n');
  }

  error(message) {
    const timestamp = this.getTimestamp();
    const logLine = `[${timestamp}] ERROR | ${message}`;
    console.error(message);
    this.fileStream.write(logLine + '\n');
  }

  trackHttp403(slug, filename, url) {
    this.http403Errors.push({
      slug,
      filename,
      url,
      timestamp: this.getTimestamp()
    });
  }

  writeSummary(converted, skipped, errors) {
    const divider = '='.repeat(80);
    const summary = `
${divider}
CONVERSION SUMMARY
Completed: ${new Date().toLocaleString()}
Duration: ${this.getDuration()}
${divider}
✓ Converted: ${converted} posts
⏭  Skipped: ${skipped} posts
✗ Post Errors: ${errors.length}
✗ Image 403 Failures: ${this.http403Errors.length} images
${divider}
`;

    console.log(summary);
    this.fileStream.write(summary);

    // Write 403 error section if any exist
    if (this.http403Errors.length > 0) {
      this.writeHttp403Section();
    }
  }

  writeHttp403Section() {
    const divider = '='.repeat(80);
    const header = `\n${divider}\nHTTP 403 IMAGE FAILURES (${this.http403Errors.length} images across ${new Set(this.http403Errors.map(e => e.slug)).size} posts)\n${divider}\n`;

    console.log(header);
    this.fileStream.write(header);

    // Group by slug
    const groupedBySlug = {};
    this.http403Errors.forEach(error => {
      if (!groupedBySlug[error.slug]) {
        groupedBySlug[error.slug] = [];
      }
      groupedBySlug[error.slug].push(error);
    });

    // Write each group
    Object.entries(groupedBySlug).forEach(([slug, errors]) => {
      const postSection = `\nPost: ${slug}\n`;
      console.log(postSection);
      this.fileStream.write(postSection);

      errors.forEach((error, index) => {
        const errorLine = `  ✗ [${index + 1}/${errors.length}] ${error.filename}\n    ${error.url}\n`;
        console.log(`  ✗ [${index + 1}/${errors.length}] ${error.filename}`);
        console.log(`    ${error.url}`);
        this.fileStream.write(errorLine);
      });
    });

    const footer = `\n${divider}\n`;
    console.log(footer);
    this.fileStream.write(footer);
  }

  close() {
    return new Promise((resolve) => {
      this.fileStream.end(() => {
        console.log(`\n📋 Log file saved to: ${this.logFilePath}`);
        resolve();
      });
    });
  }
}

// Initialize logger
const logFilePath = process.env.LOG_FILE;
const logger = new Logger(logFilePath);

// Write header to log file
logger.fileStream.write(`${'='.repeat(80)}\nHashnode Export Conversion Log\nStarted: ${new Date().toLocaleString()}\n${'='.repeat(80)}\n\n`);

// Determine export and read directories from environment variables
const exportDirName = process.env.EXPORT_DIR || 'blog';
const readDirName = process.env.READ_DIR || 'blog';

const exportDir = path.join(process.cwd(), exportDirName);
const readDir = path.join(process.cwd(), readDirName);

// Verify the export directory exists
if (!fs.existsSync(exportDir)) {
  logger.error(`✗ Error: Export directory does not exist: ${exportDir}`);
  process.exit(1);
}

// Verify the read directory exists
if (!fs.existsSync(readDir)) {
  logger.error(`✗ Error: Read directory does not exist: ${readDir}`);
  process.exit(1);
}

// Read the Hashnode export
const exportPath = path.join(__dirname, 'hashnode', 'export-articles.json');
const data = JSON.parse(fs.readFileSync(exportPath, 'utf8'));

logger.info(`📚 Found ${data.posts.length} posts to convert`);

// Helper function to download image
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }

      const fileStream = fs.createWriteStream(filepath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

// Extract image filename hash from URL
function extractHash(url) {
  const match = url.match(/\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.(png|jpg|jpeg|gif|webp)/i);
  if (match) {
    return `${match[1]}.${match[2]}`;
  }
  return null;
}


// Main async function
async function main() {
  let converted = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < data.posts.length; i++) {
    const post = data.posts[i];
    let { title, dateAdded, brief, slug, contentMarkdown, coverImage } = post;

    // Check if slug already exists in read directory
    const postDirExists = fs.existsSync(path.join(readDir, slug));

    if (postDirExists) {
      logger.info(`⏭  [${i + 1}/${data.posts.length}] Skipped: "${title}" (${slug})`);
      skipped++;
      continue;
    }

    try {
      logger.info(`\n📝 [${i + 1}/${data.posts.length}] Converting: "${title}" (${slug})`);

      // Sanitize description: remove newlines and escape quotes
      const description = brief.replace(/\n/g, ' ').replace(/"/g, '\\"');

      // Fix Hashnode image format: remove all align attributes
      let fixedContent = contentMarkdown.replace(/ align="[^"]*"/g, '');

      // Create the export directory
      const blogDir = path.join(exportDir, slug);
      if (!fs.existsSync(blogDir)) {
        fs.mkdirSync(blogDir, { recursive: true });
      }

      // Download images and update URLs (match images with any alt text, not just empty)
      const imageRegex = /!\[[^\]]*\]\((https:\/\/cdn\.hashnode\.com[^\)]+)\)/g;
      const matches = [...fixedContent.matchAll(imageRegex)];

      for (const match of matches) {
        const url = match[1];
        const filename = extractHash(url);

        if (!filename) {
          logger.warn(`    ⚠ Could not extract hash from: ${url}`);
          continue;
        }

        const filepath = path.join(blogDir, filename);

        // Skip if already exists
        if (fs.existsSync(filepath)) {
          logger.success(`    ✓ Image already exists: ${filename}`);
        } else {
          try {
            await downloadImage(url, filepath);
            logger.success(`    ✓ Downloaded: ${filename}`);
          } catch (err) {
            logger.warn(`    ⚠ Failed to download ${filename}: ${err.message}`);
            // Track HTTP 403 errors specifically
            if (err.message.includes('HTTP 403')) {
              logger.error(`      └─ [HTTP 403] Image not accessible`);
              logger.error(`      └─ Post: ${slug}`);
              logger.error(`      └─ URL: ${url}`);
              logger.trackHttp403(slug, filename, url);
            }
          }
        }

        // Replace CDN URL with relative path
        fixedContent = fixedContent.replace(url, `./${filename}`);

        // Add small delay between downloads to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, IMAGE_DOWNLOAD_DELAY_MS));
      }

      // Download cover image
      if (coverImage) {
        const coverUrl = coverImage;
        const extMatch = coverUrl.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i);
        const coverExt = (extMatch && extMatch[1]) || 'jpeg';
        const coverFilename = `cover.${coverExt}`;
        const coverPath = path.join(blogDir, coverFilename);

        if (fs.existsSync(coverPath)) {
          logger.success(`    ✓ Cover image already exists: ${coverFilename}`);
        } else {
          try {
            await downloadImage(coverUrl, coverPath);
            logger.success(`    ✓ Downloaded cover: ${coverFilename}`);
          } catch (err) {
            logger.warn(`    ⚠ Failed to download cover: ${err.message}`);
            // Track HTTP 403 errors specifically
            if (err.message.includes('HTTP 403')) {
              logger.error(`      └─ [HTTP 403] Cover image not accessible`);
              logger.error(`      └─ Post: ${slug}`);
              logger.error(`      └─ URL: ${coverUrl}`);
              logger.trackHttp403(slug, coverFilename, coverUrl);
            }
          }
        }
      }

      // Generate YAML frontmatter
      const frontmatter = `---
title: ${title}
date: "${dateAdded}"
description: "${description}"
tags:
---
`;

      // Combine frontmatter + content
      const markdown = frontmatter + '\n' + fixedContent;

      // Write the markdown file
      const indexPath = path.join(blogDir, 'index.md');
      fs.writeFileSync(indexPath, markdown, 'utf8');

      logger.success(`    ✓ Created: index.md`);
      converted++;
    } catch (err) {
      logger.error(`    ✗ Error: ${err.message}`);
      errors.push({ slug, error: err.message });
    }
  }

  // Write summary and close logger
  logger.writeSummary(converted, skipped, errors);
  await logger.close();
}

main().catch(err => {
  logger.error(`✗ Fatal error: ${err.message}`);
  logger.close().then(() => process.exit(1));
});
