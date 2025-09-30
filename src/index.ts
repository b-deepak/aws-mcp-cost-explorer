#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';
import { AWSCostExplorer, CostQueryParams } from './cost-explorer.js';

// Load environment variables
dotenv.config();

// Validate required environment variables
// AWS_REGION is required, credentials can come from SSO or env vars
if (!process.env.AWS_REGION) {
  console.error('Error: Missing required environment variable: AWS_REGION');
  process.exit(1);
}

// Initialize AWS Cost Explorer client
const costExplorer = new AWSCostExplorer(process.env.AWS_REGION!);

// Define available tools
const TOOLS: Tool[] = [
  {
    name: 'get_cost_and_usage',
    description:
      'Query AWS Cost Explorer to retrieve cost and usage data for a specified time period. ' +
      'Returns cost metrics (BlendedCost, UnblendedCost) broken down by time period and optionally grouped by dimensions like SERVICE, USAGE_TYPE, etc. ' +
      'Date format: YYYY-MM-DD. Respects AWS API rate limits.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format (e.g., 2024-01-01)',
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (e.g., 2024-01-31)',
        },
        granularity: {
          type: 'string',
          enum: ['DAILY', 'MONTHLY', 'HOURLY'],
          description: 'Time granularity for the data (default: DAILY)',
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Cost metrics to retrieve (default: ["BlendedCost", "UnblendedCost"]). ' +
            'Available: BlendedCost, UnblendedCost, AmortizedCost, NetAmortizedCost, UsageQuantity, NormalizedUsageAmount',
        },
        groupBy: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description: 'Group type (DIMENSION or TAG)',
              },
              key: {
                type: 'string',
                description:
                  'Dimension key (e.g., SERVICE, USAGE_TYPE, REGION, LINKED_ACCOUNT) or tag key',
              },
            },
            required: ['type', 'key'],
          },
          description: 'Group results by dimensions or tags (e.g., by SERVICE to see per-service costs)',
        },
      },
      required: ['startDate', 'endDate'],
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'aws-cost-explorer',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handler for listing available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handler for tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'get_cost_and_usage') {
      // Validate required arguments
      if (!args || typeof args !== 'object') {
        throw new Error('Invalid arguments');
      }

      const { startDate, endDate, granularity, metrics, groupBy } = args as any;

      if (!startDate || !endDate) {
        throw new Error('startDate and endDate are required');
      }

      // Build query parameters
      const queryParams: CostQueryParams = {
        startDate,
        endDate,
        granularity: granularity || 'DAILY',
        metrics: metrics || ['BlendedCost', 'UnblendedCost'],
      };

      if (groupBy && Array.isArray(groupBy) && groupBy.length > 0) {
        // Filter out any invalid group definitions
        const validGroups = groupBy.filter(
          (g: any) => {
            console.error('DEBUG groupBy item:', JSON.stringify(g));
            return g && typeof g === 'object' &&
                   g.type && typeof g.type === 'string' && g.type.trim() !== '' &&
                   g.key && typeof g.key === 'string' && g.key.trim() !== '';
          }
        );
        console.error('DEBUG validGroups:', JSON.stringify(validGroups));
        if (validGroups.length > 0) {
          queryParams.groupBy = validGroups;
        }
      }

      // Query AWS Cost Explorer
      const response = await costExplorer.getCostAndUsage(queryParams);
      const formattedData = costExplorer.formatCostData(response);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(formattedData, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AWS Cost Explorer MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});