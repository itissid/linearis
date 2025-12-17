#!/usr/bin/env node
/**
 * Linearis MCP Server
 *
 * Exposes Linear.app operations as MCP tools for AI assistants.
 * Uses stdio transport for local development and Claude Desktop integration.
 *
 * Environment:
 *   LINEAR_API_TOKEN - Required. Linear API token for authentication.
 *
 * Usage:
 *   LINEAR_API_TOKEN=xxx node dist/mcp-server.js
 *
 * Testing:
 *   npx @modelcontextprotocol/inspector node dist/mcp-server.js
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { GraphQLService } from "./utils/graphql-service.js";
import { LinearService } from "./utils/linear-service.js";
import { GraphQLIssuesService } from "./utils/graphql-issues-service.js";

// Get API token from environment (required for MCP server)
const apiToken = process.env.LINEAR_API_TOKEN;
if (!apiToken) {
  console.error(
    JSON.stringify({
      error:
        "LINEAR_API_TOKEN environment variable is required. " +
        "Set it before starting the MCP server.",
    }),
  );
  process.exit(1);
}

// Initialize services
const graphQLService = new GraphQLService(apiToken);
const linearService = new LinearService(apiToken);
const issuesService = new GraphQLIssuesService(graphQLService, linearService);

// Create MCP server
const server = new McpServer({
  name: "linearis",
  version: "1.0.0",
});

/**
 * Create a successful tool result
 */
function success(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Create an error tool result
 */
function errorResult(message: string) {
  console.error(`Tool error: ${message}`);
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }, null, 2) }],
  };
}

/**
 * Wrap an async handler with error handling
 */
async function withErrorHandling<T>(fn: () => Promise<T>) {
  try {
    const result = await fn();
    return success(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(message);
  }
}

// =============================================================================
// TEAM TOOLS
// =============================================================================

server.registerTool(
  "linear_teams_list",
  {
    description: "List all teams in the Linear workspace",
    inputSchema: {},
  },
  async () => {
    return withErrorHandling(() => linearService.getTeams());
  },
);

// =============================================================================
// USER TOOLS
// =============================================================================

server.registerTool(
  "linear_users_list",
  {
    description: "List all users in the Linear workspace",
    inputSchema: {
      active_only: z.boolean().optional().describe("Only return active users"),
    },
  },
  async ({ active_only }) => {
    return withErrorHandling(() => linearService.getUsers(active_only));
  },
);

// =============================================================================
// PROJECT TOOLS
// =============================================================================

server.registerTool(
  "linear_projects_list",
  {
    description: "List all projects in the Linear workspace",
    inputSchema: {},
  },
  async () => {
    return withErrorHandling(() => linearService.getProjects());
  },
);

// =============================================================================
// LABEL TOOLS
// =============================================================================

server.registerTool(
  "linear_labels_list",
  {
    description: "List all labels in the Linear workspace",
    inputSchema: {
      team: z.string().optional().describe("Filter by team key, name, or ID"),
    },
  },
  async ({ team }) => {
    return withErrorHandling(() => linearService.getLabels(team));
  },
);

// =============================================================================
// CYCLE TOOLS
// =============================================================================

server.registerTool(
  "linear_cycles_list",
  {
    description: "List cycles in the Linear workspace",
    inputSchema: {
      team: z.string().optional().describe("Filter by team key, name, or ID"),
      active: z.boolean().optional().describe("Only return the active cycle"),
    },
  },
  async ({ team, active }) => {
    return withErrorHandling(() => linearService.getCycles(team, active));
  },
);

// =============================================================================
// ISSUE TOOLS
// =============================================================================

server.registerTool(
  "linear_issues_list",
  {
    description: "List recent issues from Linear",
    inputSchema: {
      limit: z
        .number()
        .optional()
        .default(25)
        .describe("Maximum number of issues to return"),
    },
  },
  async ({ limit }) => {
    return withErrorHandling(() => issuesService.getIssues(limit));
  },
);

server.registerTool(
  "linear_issues_search",
  {
    description:
      "Search issues with optional filters. Use query for text search, or filters for structured search.",
    inputSchema: {
      query: z.string().optional().describe("Search query text"),
      team: z.string().optional().describe("Team key, name, or ID"),
      project: z.string().optional().describe("Project name or ID"),
      assignee: z.string().optional().describe("Assignee user ID or email"),
      states: z.string().optional().describe("Comma-separated status names"),
      limit: z.number().optional().default(10).describe("Maximum results"),
    },
  },
  async ({ query, team, project, assignee, states, limit }) => {
    return withErrorHandling(() =>
      issuesService.searchIssues({
        query,
        teamId: team,
        projectId: project,
        assigneeId: assignee,
        status: states?.split(",").map((s) => s.trim()),
        limit,
      }),
    );
  },
);

server.registerTool(
  "linear_issues_read",
  {
    description:
      "Get a single issue by ID or identifier (e.g., ABC-123). Returns full issue details including comments.",
    inputSchema: {
      id: z.string().describe("Issue UUID or identifier (e.g., ABC-123)"),
    },
  },
  async ({ id }) => {
    return withErrorHandling(() => issuesService.getIssueById(id));
  },
);

server.registerTool(
  "linear_issues_create",
  {
    description:
      "Create a new issue in Linear. Team is required, all other fields are optional.",
    inputSchema: {
      title: z.string().describe("Issue title"),
      team: z.string().describe("Team key, name, or ID (required)"),
      description: z
        .string()
        .optional()
        .describe("Issue description in markdown"),
      assignee: z.string().optional().describe("Assignee user ID"),
      priority: z
        .number()
        .min(0)
        .max(4)
        .optional()
        .describe("Priority 0-4 (0=none, 1=urgent, 4=low)"),
      project: z.string().optional().describe("Project name or ID"),
      status: z.string().optional().describe("Status name or ID"),
      labels: z.string().optional().describe("Comma-separated label names"),
      parent_ticket: z
        .string()
        .optional()
        .describe("Parent issue ID or ABC-123"),
      project_milestone: z.string().optional().describe("Milestone name or ID"),
      cycle: z.string().optional().describe("Cycle name or ID"),
    },
  },
  async (args) => {
    return withErrorHandling(() =>
      issuesService.createIssue({
        title: args.title,
        teamId: args.team,
        description: args.description,
        assigneeId: args.assignee,
        priority: args.priority,
        projectId: args.project,
        statusId: args.status,
        labelIds: args.labels?.split(",").map((l) => l.trim()),
        parentId: args.parent_ticket,
        milestoneId: args.project_milestone,
        cycleId: args.cycle,
      }),
    );
  },
);

server.registerTool(
  "linear_issues_update",
  {
    description:
      "Update an existing issue in Linear. Only provided fields will be updated.",
    inputSchema: {
      id: z.string().describe("Issue ID or identifier (ABC-123)"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      status: z.string().optional().describe("Status name or ID"),
      priority: z.number().min(0).max(4).optional().describe("Priority 0-4"),
      assignee: z.string().optional().describe("Assignee user ID"),
      project: z.string().optional().describe("Project name or ID"),
      labels: z.string().optional().describe("Comma-separated label names"),
      label_mode: z
        .enum(["adding", "overwriting"])
        .optional()
        .default("adding")
        .describe(
          "How to handle labels - 'adding' merges, 'overwriting' replaces",
        ),
      parent_ticket: z.string().optional().describe("Parent issue ID"),
      clear_parent: z.boolean().optional().describe("Remove parent reference"),
      project_milestone: z.string().optional().describe("Milestone name or ID"),
      clear_milestone: z.boolean().optional().describe("Remove milestone"),
      cycle: z.string().optional().describe("Cycle name or ID"),
      clear_cycle: z.boolean().optional().describe("Remove from cycle"),
    },
  },
  async (args) => {
    return withErrorHandling(() =>
      issuesService.updateIssue(
        {
          id: args.id,
          title: args.title,
          description: args.description,
          statusId: args.status,
          priority: args.priority,
          assigneeId: args.assignee,
          projectId: args.project,
          labelIds: args.labels?.split(",").map((l) => l.trim()),
          parentId: args.clear_parent ? undefined : args.parent_ticket,
          milestoneId: args.clear_milestone ? null : args.project_milestone,
          cycleId: args.clear_cycle ? null : args.cycle,
        },
        args.label_mode || "adding",
      ),
    );
  },
);

// =============================================================================
// COMMENT TOOLS
// =============================================================================

server.registerTool(
  "linear_comments_create",
  {
    description: "Add a comment to an issue",
    inputSchema: {
      issue_id: z.string().describe("Issue ID or identifier (ABC-123)"),
      body: z.string().describe("Comment body in markdown"),
    },
  },
  async ({ issue_id, body }) => {
    return withErrorHandling(async () => {
      const resolvedId = await linearService.resolveIssueId(issue_id);
      return linearService.createComment({
        issueId: resolvedId,
        body,
      });
    });
  },
);

// =============================================================================
// INITIATIVE TOOLS
// =============================================================================

server.registerTool(
  "linear_initiatives_list",
  {
    description:
      "List initiatives in the Linear workspace. Initiatives are high-level strategic goals that can contain multiple projects.",
    inputSchema: {
      status: z
        .enum(["Planned", "Active", "Completed"])
        .optional()
        .describe("Filter by status"),
    },
  },
  async ({ status }) => {
    return withErrorHandling(() => linearService.getInitiatives(status));
  },
);

server.registerTool(
  "linear_initiatives_read",
  {
    description: "Get an initiative with its projects and details",
    inputSchema: {
      id: z.string().describe("Initiative ID or name"),
    },
  },
  async ({ id }) => {
    return withErrorHandling(() => linearService.getInitiativeById(id));
  },
);

server.registerTool(
  "linear_initiatives_update",
  {
    description: "Update an initiative's fields",
    inputSchema: {
      id: z.string().describe("Initiative ID or name"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New short description"),
      content: z.string().optional().describe("New body content (markdown)"),
      status: z
        .enum(["Planned", "Active", "Completed"])
        .optional()
        .describe("New status"),
    },
  },
  async (args) => {
    return withErrorHandling(() =>
      linearService.updateInitiative(args.id, {
        name: args.name,
        description: args.description,
        content: args.content,
        status: args.status as "Planned" | "Active" | "Completed" | undefined,
      }),
    );
  },
);

// =============================================================================
// START SERVER
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
