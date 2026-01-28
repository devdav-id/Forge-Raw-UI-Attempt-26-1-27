# Forge UI

A local web chat interface for Claude with tool execution capabilities.

## Quick Start

1. **Add your API key**
   Open `config.php` and replace the placeholder:
   ```php
   define('ANTHROPIC_API_KEY', 'sk-ant-api03-YOUR-ACTUAL-KEY-HERE');
   ```

2. **Start the server**
   ```bash
   cd forge-ui
   php -S localhost:8000
   ```

3. **Open in browser**
   Navigate to `http://localhost:8000`

## Features

- Streaming responses
- Tool execution (file read/write, shell commands, search)
- Different CSS classes for each message type
- Dark mode toggle
- Modular HTML/CSS/JS for customization

## Available Tools

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents |
| `write_file` | Create or overwrite files |
| `edit_file` | Replace specific strings in files |
| `list_directory` | List directory contents |
| `search_files` | Find files by glob pattern |
| `search_content` | Search text in files (grep) |
| `execute_command` | Run shell commands |
| `create_directory` | Create directories |

## Customization

### CSS Classes (Message Types)

```css
.forge-message--user         /* User messages */
.forge-message--assistant    /* Claude responses */
.forge-message--system       /* System notifications */
.forge-message--error        /* Error messages */
.forge-message--tool-use     /* Tool being called */
.forge-message--tool-result  /* Tool execution result */
.forge-message--thinking     /* Claude thinking */
.forge-message--streaming    /* Currently streaming */
```

### Theme Variables

Edit `:root` in `styles.css` to customize colors:
```css
:root {
    --forge-color-user: #0d6efd;
    --forge-color-assistant: #6f42c1;
    --forge-color-error: #dc3545;
    /* ... */
}
```

### HTML Templates

Message templates are in `index.html` inside `<template>` tags.
Modify these to change message structure.

## Files

```
forge-ui/
├── index.html    # Main page (templates here)
├── styles.css    # All styling (edit colors/layout here)
├── app.js        # Chat logic (edit behavior here)
├── api.php       # Backend API proxy
├── tools.php     # Tool definitions and execution
└── config.php    # Your API key (gitignored)
```
