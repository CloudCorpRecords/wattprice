/**
 * wattprice MCP server. Tools: fetch_prices.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * that are not in this tool's documented spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schemas as explicit literals, while zod
 * still validates every tools/call argument set.
 *
 * The single tool forwards to the ESIOS API with the caller's
 * own key (env ESIOS_API_KEY); with no key the call comes back
 * as an honest isError naming that variable.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { fetchPrices, formatPayload, VERSION } from "./wattprice.js";

const FetchArgs = z.object({
  locale: z.enum(["es", "en"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  timeAggregation: z.enum(["sum", "average"]).optional(),
  timeTruncation: z.enum(["hour", "day", "month", "year"]).optional(),
  geographicalAggregation: z.enum(["sum", "average"]).optional(),
  geographicalIds: z.array(z.string()).optional(),
  geographicalTruncation: z.enum(["country", "electric_system"]).optional(),
});

const TOOLS = [
  {
    name: "fetch_prices",
    description: "Fetch PVPC prices for a given date range and geographical area.",
    inputSchema: {
      type: "object" as const,
      properties: {
        locale: {
          type: "string",
          enum: ["es", "en"],
          description:
            "Translations for sources. Accepted values: es, en. Defaults to es.",
        },
        startDate: {
          type: "string",
          description:
            "Beginning of the date range, ISO 8601 (e.g. 2025-06-29T00:00:00.000+02:00). Defaults to the start of today.",
        },
        endDate: {
          type: "string",
          description: "End of the date range, ISO 8601. Defaults to the end of today.",
        },
        timeAggregation: {
          type: "string",
          enum: ["sum", "average"],
          description:
            "How to aggregate indicator values when grouping by time. Accepted values: sum, average. Defaults to sum.",
        },
        timeTruncation: {
          type: "string",
          enum: ["hour", "day", "month", "year"],
          description:
            "How to truncate data time series. Accepted values: hour, day, month, year.",
        },
        geographicalAggregation: {
          type: "string",
          enum: ["sum", "average"],
          description:
            "How to aggregate indicator values when grouping by geographical ID. Accepted values: sum, average. Defaults to sum.",
        },
        geographicalIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Geographical IDs to filter by. Accepted values: 3 (España), 8741 (Península), 8742 (Canarias), 8743 (Baleares), 8744 (Ceuta), 8745 (Melilla). Defaults to 8741, 8742, 8743, 8744, 8745.",
        },
        geographicalTruncation: {
          type: "string",
          enum: ["country", "electric_system"],
          description:
            "How to group data at geographical level when the geographical aggregation is informed. Accepted values: country, electric_system.",
        },
      },
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "wattprice", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "fetch_prices") {
      const parsed = FetchArgs.parse(args ?? {});
      out = await fetchPrices(parsed);
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
