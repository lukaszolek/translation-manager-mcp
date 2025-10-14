# Translation Manager MCP Server

An MCP (Model Context Protocol) server for managing translations with review workflow, automatic non-breaking spaces insertion, and real-time file watching.

## Features

- 📝 **Translation Management**: Load, edit, and save translations from JSON files
- ✅ **Review Workflow**: Track which translations have been checked/reviewed
- 🔄 **Auto-Save**: Automatically saves changes when translations are updated
- 👁️ **File Watching**: Monitors translation files for external changes and auto-reloads
- 🌍 **Non-Breaking Spaces**: Automatically applies language-specific non-breaking space rules
- 🎯 **Missing Translation Detection**: Identifies keys missing translations in any locale
- 🔍 **Prefix-Based Operations**: Search, filter, and delete translations by key prefix
- 📊 **Translation Status**: Get comprehensive status reports of translation completeness

## Supported Languages for Non-Breaking Spaces

The server includes built-in rules for proper non-breaking space insertion in:

- 🇵🇱 Polish (pl)
- 🇨🇿 Czech (cs)
- 🇸🇰 Slovak (sk)
- 🇫🇷 French (fr)
- 🇩🇪 German (de)
- 🇭🇺 Hungarian (hu)
- 🇪🇸 Spanish (es)
- 🇮🇹 Italian (it)
- 🇳🇱 Dutch (nl)

## Installation

### As an npm package

```bash
npm install @framky/translation-manager-mcp
```

### From source

```bash
git clone https://github.com/framky/translation-manager-mcp.git
cd translation-manager-mcp
npm install
```

## Usage with Claude Desktop

Add this configuration to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Basic Configuration

```json
{
  "mcpServers": {
    "translation-manager": {
      "command": "npx",
      "args": ["@framky/translation-manager-mcp"]
    }
  }
}
```

### Custom Messages Directory

You can specify a custom directory for your translation files using the `MESSAGES_DIR` environment variable:

```json
{
  "mcpServers": {
    "translation-manager": {
      "command": "npx",
      "args": ["@framky/translation-manager-mcp"],
      "env": {
        "MESSAGES_DIR": "/absolute/path/to/your/messages"
      }
    }
  }
}
```

### Local Installation

If you've installed the package locally:

```json
{
  "mcpServers": {
    "translation-manager": {
      "command": "node",
      "args": ["/path/to/translation-manager-mcp/index.js"],
      "env": {
        "MESSAGES_DIR": "/path/to/your/project/translations"
      }
    }
  }
}
```

**Note**: If `MESSAGES_DIR` is not specified, the server will look for translations in the `messages/` directory relative to the current working directory.

## File Structure

The server expects your translations to be organized as follows:

```
your-project/
├── messages/
│   ├── en-us.json        (or en.json)
│   ├── pl-pl.json        (or pl.json)
│   ├── fr-fr.json        (or fr.json)
│   ├── translation-check.json  (auto-generated)
│   └── backup/                 (auto-generated)
│       ├── en-us.1234567890.json.bak
│       └── pl-pl.1234567890.json.bak
└── .translation-state.json     (auto-generated)
```

### Supported File Naming Conventions

The server supports both naming conventions for translation files:

1. **Full locale format**: `pl-pl.json`, `en-us.json`, `fr-fr.json`
2. **Language-only format**: `pl.json`, `en.json`, `fr.json`

Both formats work identically. The language code is automatically extracted for applying non-breaking space rules.

### Translation File Format

Translation files should use nested JSON structure:

```json
{
  "common": {
    "button": {
      "save": "Save",
      "cancel": "Cancel"
    }
  },
  "auth": {
    "login": "Log in",
    "logout": "Log out"
  }
}
```

Keys are automatically flattened to dot notation internally (e.g., `common.button.save`).

## Available Tools

### 1. `get_messages_to_check`

Get the next N unchecked translations for review.

**Parameters:**
- `n` (number, default: 10): Number of messages to return

**Example:**
```json
{
  "n": 5
}
```

### 2. `update_translations`

Update translations for one or more keys and locales. Changes are auto-saved.

**Parameters:**
- `updates` (object): Translation updates with structure `{ key: { locale: translation } }`

**Example:**
```json
{
  "updates": {
    "common.button.save": {
      "en-us": "Save",
      "pl-pl": "Zapisz"
    },
    "common.button.cancel": {
      "en-us": "Cancel",
      "pl-pl": "Anuluj"
    }
  }
}
```

### 3. `mark_checked`

Mark one or more translation keys as reviewed.

**Parameters:**
- `keys` (string | array): Single key or array of keys to mark as checked

**Example:**
```json
{
  "keys": ["common.button.save", "common.button.cancel"]
}
```

### 4. `get_checked_keys`

Get a list of all translation keys that have been marked as checked.

**Returns:**
```json
{
  "count": 42,
  "keys": ["common.button.save", "common.button.cancel", ...]
}
```

### 5. `get_missing_translation_keys`

Get a list of keys that are missing translations in one or more locales.

**Returns:**
```json
{
  "count": 3,
  "keys": [
    {
      "key": "common.button.submit",
      "missingLocales": ["fr-fr", "de-de"],
      "existingTranslations": {
        "en-us": "Submit",
        "pl-pl": "Wyślij"
      }
    }
  ]
}
```

### 6. `get_translation_by_key_prefix`

Get all translations for keys starting with a specific prefix.

**Parameters:**
- `keyPrefix` (string): The prefix to search for

**Example:**
```json
{
  "keyPrefix": "common.button"
}
```

### 7. `add_translations`

Add new translation keys with their translations.

**Parameters:**
- `translations` (object): New translations with structure `{ key: { locale: translation } }`

**Example:**
```json
{
  "translations": {
    "common.button.submit": {
      "en-us": "Submit",
      "pl-pl": "Wyślij",
      "fr-fr": "Soumettre"
    }
  }
}
```

### 8. `delete_keys_by_prefix`

Delete all translation keys with a given prefix. Changes are auto-saved.

**Parameters:**
- `prefix` (string): The prefix of keys to delete

**Example:**
```json
{
  "prefix": "old.deprecated"
}
```

### 9. `load_from_json`

Manually reload all translations from JSON files.

**Returns:**
```json
{
  "success": true,
  "message": "Translations reloaded from JSON files",
  "keyCount": 150,
  "locales": ["en-us", "pl-pl", "fr-fr"]
}
```

### 10. `save_to_json`

Manually save all translations to JSON files.

**Returns:**
```json
{
  "success": true,
  "savedLocales": ["en-us", "pl-pl", "translation-check"],
  "keyCount": 150
}
```

### 11. `apply_non_breaking_spaces`

Apply non-breaking space rules to all existing translations based on their language.

**Returns:**
```json
{
  "success": true,
  "totalKeys": 150,
  "totalLocales": 3,
  "updatedTranslations": 45
}
```

### 12. `get_translation_status`

Get a summary of translation status across all locales.

**Returns:**
```json
{
  "total": 150,
  "missingTranslations": 12,
  "waitingForCheck": 35
}
```

## Non-Breaking Spaces

The server automatically applies language-specific non-breaking space rules when saving translations. This includes:

### Polish, Czech, Slovak
- After single-letter words (a, i, o, u, w, z)
- After short prepositions and conjunctions
- Between numbers and units
- Before single digits when they appear as separate words

### French
- Before special punctuation marks (: ; ! ? »)
- After single-letter words
- Between numbers and units

### Other Languages
- Custom rules for German, Hungarian, Spanish, Italian, and Dutch
- Between numbers and their units (all supported languages)

## File Watching

The server automatically watches the `messages/` directory for changes to translation files. When changes are detected:

1. Changes are debounced (500ms) to avoid multiple rapid reloads
2. Previous state is loaded to detect what changed
3. Translations are reloaded from disk
4. New/modified translations are marked as unchecked

## Backup System

Every time translations are saved, the server:

1. Creates a timestamped backup in `messages/backup/`
2. Saves the new content
3. Keeps backups indefinitely (manual cleanup recommended)

## Development

### Running locally

```bash
npm start
```

### Testing

The server communicates via stdio using the MCP protocol. You can test it with Claude Desktop or any MCP-compatible client.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/framky/translation-manager-mcp/issues).
