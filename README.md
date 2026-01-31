# Helium

A terminal UI AI coding assistant with support for multiple AI providers.

## Supported Providers

- **Anthropic** (Claude)
- **Google** (Gemini)
- **OpenAI** (GPT)

## Requirements

- [Bun](https://bun.sh) runtime
- [fzf](https://github.com/junegunn/fzf) for file search
- API key for at least one provider

## Installation

```bash
git clone https://github.com/anthropics/helium.git
cd helium
bun install
```

## Configuration

Create your auth configuration file at `~/.helium/agent/auth.json`:

```json
{
  "anthropic": {
    "apiKey": "sk-ant-..."
  },
  "google": {
    "apiKey": "..."
  },
  "openai": {
    "apiKey": "sk-..."
  }
}
```

Add API keys for the providers you want to use.

## Usage

Start Helium:

```bash
bun run dev
```

### Switching Models

Use the `/model` command to open the model selector and switch between providers and models.

### File References

Type `@` followed by a filename to search and reference files in your project. The file selector uses fuzzy matching to find files tracked by git.

### Key Bindings

| Key | Action |
|-----|--------|
| `Enter` | Submit message |
| `Shift+Enter` | New line |
| `Up/Down` | Navigate menus |
| `Escape` | Cancel dialogs |

## Project Context

Place a `CLAUDE.md` file in your project root to provide context and instructions that will be included in every conversation.
