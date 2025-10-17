# Translation Manager MCP Server

An MCP (Model Context Protocol) server for managing translations with review workflow, automatic non-breaking spaces insertion, and real-time file watching.

## Features

- 📝 **Translation Management**: Load, edit, and save translations from JSON files
- ✅ **Review Workflow**: Track which translations have been checked/reviewed
- 🔄 **Auto-Save**: Automatically saves changes when translations are updated (no manual save needed)
- 👁️ **File Watching**: Monitors translation files for external changes and auto-reloads
- 🌍 **Non-Breaking Spaces**: Automatically applies language-specific non-breaking space rules
- 🎯 **Missing Translation Detection**: Identifies keys missing translations in any locale (with pagination)
- 🔍 **Prefix-Based Operations**: Search, filter, and delete translations by key prefix (with pagination)
- 📊 **Translation Status**: Get comprehensive status reports of translation completeness
- 💾 **Efficient Responses**: Minimal token usage with concise API responses
- 🌐 **Locale-Specific Deletion**: Delete keys from specific locales without affecting others

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
│   └── translation-check.json  (auto-generated)
└── .translation-state.json     (auto-generated, at server root)
```

**Note**: The server no longer creates backups. Use version control (e.g., Git) to track changes to your translation files.

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

**Returns:**
```json
{
  "translation.key": {
    "pl-pl": "Polish translation",
    "en-us": "English translation"
  }
}
```

### 2. `update_translations`

Update translations for one or more keys and locales. Changes are automatically saved to JSON files.

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

**Returns:**
```json
{
  "success": true,
  "updatedKeys": 2
}
```

### 3. `mark_checked`

Mark one or more translation keys as reviewed. Status is automatically saved.

**Parameters:**
- `keys` (string | array): Single key or array of keys to mark as checked

**Example:**
```json
{
  "keys": ["common.button.save", "common.button.cancel"]
}
```

**Returns:**
```json
{
  "success": true,
  "markedCount": 2
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

Get a paginated list of keys that are missing translations in one or more locales.

**Parameters:**
- `page` (number, default: 1): Page number
- `pageSize` (number, default: 50): Number of items per page

**Example:**
```json
{
  "page": 1,
  "pageSize": 20
}
```

**Returns:**
```json
{
  "count": 123,
  "totalPages": 7,
  "currentPage": 1,
  "pageSize": 20,
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

Get all translations for keys starting with a specific prefix, with pagination support.

**Parameters:**
- `keyPrefix` (string, required): The prefix to search for
- `page` (number, default: 1): Page number
- `pageSize` (number, default: 50): Number of items per page

**Example:**
```json
{
  "keyPrefix": "common.button",
  "page": 1,
  "pageSize": 25
}
```

**Returns:**
```json
{
  "count": 45,
  "totalPages": 2,
  "currentPage": 1,
  "pageSize": 25,
  "keys": {
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

### 7. `add_translations`

Add new translation keys with their translations. Changes are automatically saved to JSON files.

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

**Returns:**
```json
{
  "success": true,
  "addedKeys": 1,
  "addedLocales": ["en-us", "pl-pl", "fr-fr"]
}
```

### 8. `delete_keys_by_prefix`

Delete translation keys with a given prefix. Can delete from all locales or specific locales only. Changes are automatically saved.

**Parameters:**
- `prefix` (string, required): The prefix of keys to delete
- `locales` (array, optional): Array of locale codes to delete from (e.g., `["pl-pl", "en-gb"]`). If not provided, deletes entire keys from all locales.

**Example 1 - Delete from all locales:**
```json
{
  "prefix": "old.deprecated"
}
```

**Example 2 - Delete only from specific locales:**
```json
{
  "prefix": "HomePage.hero",
  "locales": ["pl-pl", "de-de"]
}
```

**Returns:**
```json
{
  "success": true,
  "deletedCount": 12
}
```

### 9. `get_translation_status`

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

The server automatically applies language-specific non-breaking space rules when saving translations. This process is transparent and happens automatically - you don't need to call any special function.

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

## Automatic Features

### Auto-Save
The following operations automatically save changes to JSON files:
- `update_translations` - saves only modified locales
- `add_translations` - saves all affected locales
- `delete_keys_by_prefix` - saves all affected files
- `mark_checked` - saves the checked status

You don't need to manually call save - it happens automatically after each modification.

### File Watching

The server automatically watches the `messages/` directory for changes to translation files. When changes are detected:

1. Changes are debounced (500ms) to avoid multiple rapid reloads
2. Previous state is loaded to detect what changed
3. Translations are reloaded from disk
4. New/modified translations are marked as unchecked

This allows you to edit translation files externally (e.g., in your IDE) and have them automatically reflected in the MCP server.

## Development

### Running locally

```bash
npm start
```

### Testing

Run the comprehensive test suite:

```bash
npm test
```

The test suite includes 41 automated tests covering:
- All API response formats
- Pagination functionality
- Auto-save behavior
- Locale-specific deletion
- Non-breaking space application
- No backup file creation

See [TESTING.md](TESTING.md) for detailed testing documentation.

### Manual Testing

The server communicates via stdio using the MCP protocol. You can test it with Claude Desktop or any MCP-compatible client.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/framky/translation-manager-mcp/issues).
