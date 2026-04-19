import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AutomationService } from './automation.service';

@ApiTags('automation')
@ApiBearerAuth()
@Controller({ path: 'automation', version: '1' })
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get('rules')
  @ApiOperation({ summary: 'Danh sách rule + schema conditions chúng chấp nhận' })
  rules() {
    return this.automation.listRules();
  }
}
