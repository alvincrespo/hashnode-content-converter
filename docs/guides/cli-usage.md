# CLI Usage

The CLI provides a straightforward way to convert Hashnode exports from the command line.

## Basic Command

```bash
hashnode-converter convert --export <path> --output <path>
```

Or using npx:

```bash
npx @alvincrespo/hashnode-content-converter convert --export <path> --output <path>
```

## Options

| Option | Alias | Required | Default | Description |
|--------|-------|----------|---------|-------------|
| `--export <path>` | `-e` | Yes | - | Path to Hashnode export JSON file |
| `--output <path>` | `-o` | Yes | - | Output directory for converted files |
| `--log-file <path>` | `-l` | No | - | Path for conversion log file |
| `--skip-existing` | - | No | `true` | Skip posts that already exist |
| `--no-skip-existing` | - | No | - | Re-convert all posts |
| `--verbose` | `-v` | No | `false` | Show detailed output including images |
| `--quiet` | `-q` | No | `false` | Suppress all output except errors |
| `--help` | `-h` | No | - | Show help |
| `--version` | `-V` | No | - | Show version |

## Examples

### Basic Conversion

```bash
hashnode-converter convert \
  --export ./hashnode-export.json \
  --output ./content/blog
```

### With Verbose Output

```bash
hashnode-converter convert \
  --export ./hashnode-export.json \
  --output ./content/blog \
  --verbose
```

Shows detailed progress including image downloads:

```
Converting: My First Post
  Downloading: https://cdn.hashnode.com/res/image1.png
  Downloading: https://cdn.hashnode.com/res/image2.png
Converting: Another Post
...
```

### Re-convert All Posts

By default, existing posts are skipped. To force re-conversion:

```bash
hashnode-converter convert \
  --export ./hashnode-export.json \
  --output ./content/blog \
  --no-skip-existing
```

### With Log File

```bash
hashnode-converter convert \
  --export ./hashnode-export.json \
  --output ./content/blog \
  --log-file ./conversion.log
```

### Quiet Mode

For use in scripts where you only want to see errors:

```bash
hashnode-converter convert \
  --export ./hashnode-export.json \
  --output ./content/blog \
  --quiet
```

## Exit Codes

| Code | Description |
|------|-------------|
| `0` | Success - all posts converted |
| `1` | Error - conversion failed or invalid arguments |

## Progress Display

The CLI shows a progress bar during conversion:

```
Converting posts...
[████████████████████████████████████████] 100% | 25/25 posts

Conversion complete!
  Converted: 23
  Skipped: 2
  Errors: 0
  Duration: 45.2s
```

## Handling Errors

If some posts fail to convert, they are logged but don't stop the process:

```
Converting posts...
[████████████████████████████████████████] 100% | 25/25 posts

Conversion complete!
  Converted: 23
  Skipped: 0
  Errors: 2
  Duration: 45.2s

Errors:
  - my-broken-post: Failed to download image
  - another-post: Invalid markdown content
```

Use `--log-file` to save error details for debugging.
