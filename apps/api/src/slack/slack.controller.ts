import { Body, Controller, Logger, Post, Req } from "@nestjs/common";

import type { SlackRfqIntakeInput } from "@auto8/shared";

import { SlackRfqIntakeDto } from "./dto/slack-rfq-intake.dto";

import { Public } from "../rbac/public.decorator";
import { ConnectorRunService } from "../scheduler/connector-run.service";
import { SlackConnectorService } from "./slack-connector.service";

@Controller("connectors/slack")
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(
    private readonly slackConnectorService: SlackConnectorService,
    private readonly connectorRunService: ConnectorRunService
  ) {}

  @Post("intake")
  @Public()
  async intake(
    @Body() body: SlackRfqIntakeDto,
    @Req() request: { rawBody?: Buffer; headers: Record<string, string | string[] | undefined> }
  ) {
    let result: Awaited<ReturnType<typeof this.slackConnectorService.intakeSlack>> | undefined;
    await this.connectorRunService.runConnector("slack", async () => {
      const rawPayload = request.rawBody?.toString("utf8") ?? JSON.stringify(body);
      result = await this.slackConnectorService.intakeSlack(body, rawPayload, request.headers);
      return { imported: 1, skipped: 0, failed: 0, importedReferences: [], errors: [] };
    }, { rethrow: true });
    return result;
  }

  @Post("events")
  @Public()
  async events(
    @Body() body: Record<string, any>,
    @Req() request: { rawBody?: Buffer; headers: Record<string, string | string[] | undefined> }
  ) {
    const rawPayload = request.rawBody?.toString("utf8") ?? JSON.stringify(body);
    return this.slackConnectorService.handleEvent(body, rawPayload, request.headers);
  }
}
