import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { NotionImportService } from './notion-import.service';

@Controller()
export class NotionImportController {
  constructor(
    private readonly notionImportService: NotionImportService,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('pages/import-notion-url')
  async importFromUrl(
    @Body() body: { url?: unknown; spaceId?: unknown },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const { url, spaceId } = body ?? {};
    if (typeof url !== 'string' || !url.trim()) {
      throw new BadRequestException('url is required');
    }
    if (typeof spaceId !== 'string' || !spaceId) {
      throw new BadRequestException('spaceId is required');
    }

    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    return this.notionImportService.importFromUrl(url, {
      userId: user.id,
      spaceId,
      workspaceId: workspace.id,
    });
  }
}
