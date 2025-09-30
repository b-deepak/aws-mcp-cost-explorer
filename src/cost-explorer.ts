import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostAndUsageCommandInput,
  GetCostAndUsageCommandOutput,
  Granularity,
  GroupDefinition,
} from '@aws-sdk/client-cost-explorer';

export interface CostQueryParams {
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format
  granularity?: 'DAILY' | 'MONTHLY' | 'HOURLY';
  metrics?: string[];
  groupBy?: Array<{ type: string; key: string }>;
  filter?: any;
}

export class AWSCostExplorer {
  private client: CostExplorerClient;

  constructor(region: string) {
    this.client = new CostExplorerClient({
      region,
      // AWS SDK automatically uses AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from env
    });
  }

  /**
   * Query AWS Cost Explorer for cost and usage data
   * Respects API rate limits with proper error handling
   */
  async getCostAndUsage(params: CostQueryParams): Promise<GetCostAndUsageCommandOutput> {
    try {
      // Validate date format
      this.validateDateFormat(params.startDate);
      this.validateDateFormat(params.endDate);

      const input: GetCostAndUsageCommandInput = {
        TimePeriod: {
          Start: params.startDate,
          End: params.endDate,
        },
        Granularity: (params.granularity || 'DAILY') as Granularity,
        Metrics: params.metrics || ['BlendedCost', 'UnblendedCost'],
      };

      // Add grouping if specified
      if (params.groupBy && params.groupBy.length > 0) {
        const allowedTypes: GroupDefinition['Type'][] = [
          'DIMENSION',
          'TAG',
          'COST_CATEGORY',
        ];

        const normalizedGroups = params.groupBy.reduce(
          (groups: GroupDefinition[], group) => {
            const type = group.type?.trim();
            const key = group.key?.trim();

            if (!type || !key) {
              return groups;
            }

            const normalizedType = type.toUpperCase() as GroupDefinition['Type'];

            if (!allowedTypes.includes(normalizedType)) {
              throw new Error(
                `Invalid groupBy type: ${group.type}. Expected one of ${allowedTypes.join(', ')}`
              );
            }

            groups.push({
              Type: normalizedType,
              Key: key,
            });

            return groups;
          },
          []
        );

        if (normalizedGroups.length > 0) {
          input.GroupBy = normalizedGroups;
        }
      }

      // Add filter if specified
      if (params.filter) {
        input.Filter = params.filter;
      }

      const command = new GetCostAndUsageCommand(input);
      const response = await this.client.send(command);

      return response;
    } catch (error: any) {
      // Handle throttling errors
      if (error.name === 'ThrottlingException') {
        throw new Error(
          'AWS Cost Explorer API rate limit exceeded. Please wait a moment and try again.'
        );
      }

      // Handle other AWS errors
      if (error.$metadata) {
        throw new Error(`AWS Cost Explorer error: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  private validateDateFormat(date: string): void {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) {
      throw new Error(
        `Invalid date format: ${date}. Expected YYYY-MM-DD format.`
      );
    }

    // Validate it's a real date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw new Error(`Invalid date: ${date}`);
    }
  }

  /**
   * Helper to format cost data into a readable structure
   */
  formatCostData(response: GetCostAndUsageCommandOutput): any {
    if (!response.ResultsByTime) {
      return { message: 'No cost data found for the specified period' };
    }

    return {
      period: {
        start: response.ResultsByTime[0]?.TimePeriod?.Start,
        end: response.ResultsByTime[response.ResultsByTime.length - 1]?.TimePeriod?.End,
      },
      results: response.ResultsByTime.map((result) => ({
        period: result.TimePeriod,
        total: result.Total,
        groups: result.Groups?.map((group) => ({
          keys: group.Keys,
          metrics: group.Metrics,
        })),
      })),
    };
  }
}
