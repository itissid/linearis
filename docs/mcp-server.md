# Linearis MCP Server

The linearis MCP server exposes Linear.app operations as tools for AI assistants using the Model Context Protocol (MCP).

## Quick Start

### Local Development (stdio)

```bash
# Build the MCP server
npm run build

# Test with MCP Inspector (requires LINEAR_API_TOKEN)
LINEAR_API_TOKEN=xxx npx @modelcontextprotocol/inspector node dist/mcp-server.js
```

### Running Directly

```bash
# Using tsx (development)
LINEAR_API_TOKEN=xxx npm run start:mcp

# Using compiled version (production)
LINEAR_API_TOKEN=xxx node dist/mcp-server.js
```

## Claude Desktop Configuration

Add to your Claude Desktop config file:

**Linux**: `~/.config/claude-desktop/claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "linearis": {
      "command": "node",
      "args": ["/path/to/linearis/dist/mcp-server.js"],
      "env": {
        "LINEAR_API_TOKEN": "lin_api_xxxxx"
      }
    }
  }
}
```

## Available Tools

### Team & Organization

| Tool | Description | Parameters |
|------|-------------|------------|
| `linear_teams_list` | List all teams | none |
| `linear_users_list` | List users | `active_only?` |
| `linear_projects_list` | List all projects | none |
| `linear_labels_list` | List labels | `team?` |
| `linear_cycles_list` | List cycles | `team?`, `active?` |

### Issues

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `linear_issues_list` | List recent issues | `limit?` (default: 25) |
| `linear_issues_search` | Search issues with filters | `query?`, `team?`, `project?`, `assignee?`, `states?`, `limit?` |
| `linear_issues_read` | Get issue by ID | `id` (UUID or ABC-123) |
| `linear_issues_create` | Create new issue | `title`, `team`, `description?`, `priority?`, `project?`, `labels?`, etc. |
| `linear_issues_update` | Update issue | `id`, plus any fields to update |

### Comments

| Tool | Description | Parameters |
|------|-------------|------------|
| `linear_comments_create` | Add comment to issue | `issue_id`, `body` |

### Initiatives

| Tool | Description | Parameters |
|------|-------------|------------|
| `linear_initiatives_list` | List initiatives | `status?` (Planned/Active/Completed) |
| `linear_initiatives_read` | Get initiative details | `id` (UUID or name) |
| `linear_initiatives_update` | Update initiative | `id`, `name?`, `description?`, `content?`, `status?` |

## Authentication

The MCP server requires the `LINEAR_API_TOKEN` environment variable to be set. You can obtain an API token from Linear's settings.

## Smart ID Resolution

The tools support human-friendly identifiers that get automatically resolved:

- **Issue IDs**: `ABC-123` or full UUID
- **Team IDs**: Team key (`ABC`), name (`"My Team"`), or UUID
- **Project IDs**: Project name or UUID
- **Label IDs**: Label names or UUIDs (comma-separated)
- **Cycle IDs**: Cycle name or UUID
- **Initiative IDs**: Initiative name or UUID

## Example Usage

### Search for issues

```json
{
  "tool": "linear_issues_search",
  "arguments": {
    "query": "authentication bug",
    "team": "Engineering",
    "states": "In Dev,Code Review",
    "limit": 20
  }
}
```

### Create an issue

```json
{
  "tool": "linear_issues_create",
  "arguments": {
    "title": "Fix login timeout issue",
    "team": "Engineering",
    "description": "Users are experiencing timeouts during login...",
    "priority": 2,
    "labels": "bug,backend"
  }
}
```

### Update issue status

```json
{
  "tool": "linear_issues_update",
  "arguments": {
    "id": "ENG-123",
    "status": "In Dev"
  }
}
```

## Error Handling

All tools return errors in a consistent format:

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "{\"error\": \"Team 'Unknown' not found\"}"
    }
  ]
}
```

## Testing

### MCP Inspector

The MCP Inspector provides an interactive UI for testing tools:

```bash
LINEAR_API_TOKEN=xxx npx @modelcontextprotocol/inspector node dist/mcp-server.js
```

### Manual Testing

```bash
# List tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
  LINEAR_API_TOKEN=xxx node dist/mcp-server.js

# Call a tool
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"linear_teams_list","arguments":{}}}' | \
  LINEAR_API_TOKEN=xxx node dist/mcp-server.js
```

## Remote Access via HTTP

For remote deployment, use `mcp-proxy` to expose the stdio server over HTTP:

```bash
npm install -g mcp-proxy

# Run with HTTP transport
LINEAR_API_TOKEN=xxx npx mcp-proxy --port 8080 node dist/mcp-server.js
```

Then connect using `mcp-remote`:

```json
{
  "mcpServers": {
    "linearis-remote": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-server.com/mcp"
      ]
    }
  }
}
```

## Related Documentation

- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Linearis CLI Documentation](./development.md)
