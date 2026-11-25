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
import { N2DatabaseService } from './database.service';

type Body_ = Record<string, any>;

/** A database is readable by whoever can read its space, editable by whoever can edit pages there. */
@UseGuards(JwtAuthGuard)
@Controller('n2/databases')
export class N2DatabaseController {
  constructor(
    private readonly service: N2DatabaseService,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(@Body() body: Body_, @AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    if (typeof body?.spaceId !== 'string' || !body.spaceId) {
      throw new BadRequestException('spaceId is required');
    }
    await this.assertCan(user, body.spaceId, SpaceCaslAction.Edit);
    return this.service.create(
      { spaceId: body.spaceId, name: body.name, schema: body.schema, views: body.views },
      { userId: user.id, workspaceId: workspace.id },
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async info(@Body() body: Body_, @AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    const database = await this.load(body, user, workspace, SpaceCaslAction.Read);
    return this.service.info(database);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() body: Body_, @AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    const database = await this.load(body, user, workspace, SpaceCaslAction.Edit);
    return this.service.update(database, { name: body.name, schema: body.schema, views: body.views });
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async remove(@Body() body: Body_, @AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    const database = await this.load(body, user, workspace, SpaceCaslAction.Edit);
    await this.service.remove(database);
  }

  @HttpCode(HttpStatus.OK)
  @Post('rows/create')
  async createRow(@Body() body: Body_, @AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    const database = await this.load(body, user, workspace, SpaceCaslAction.Edit);
    return this.service.createRow(
      database,
      { title: body.title, values: body.values, afterRowId: body.afterRowId },
      { userId: user.id, workspaceId: workspace.id },
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('rows/update')
  async updateRow(@Body() body: Body_, @AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    const database = await this.load(body, user, workspace, SpaceCaslAction.Edit);
    return this.service.updateRow(
      database,
      body.rowId,
      { title: body.title, values: body.values, afterRowId: body.afterRowId },
      { userId: user.id, workspaceId: workspace.id },
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('rows/delete')
  async removeRow(@Body() body: Body_, @AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    const database = await this.load(body, user, workspace, SpaceCaslAction.Edit);
    await this.service.removeRow(database, body.rowId, {
      userId: user.id,
      workspaceId: workspace.id,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('row-by-page')
  async rowByPage(@Body() body: Body_, @AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    const found = await this.service.rowByPage(body?.pageId, workspace.id);
    if (!found) return { database: null, row: null };
    await this.assertCan(user, found.database.spaceId, SpaceCaslAction.Read);
    return found;
  }

  private async load(body: Body_, user: User, workspace: Workspace, action: SpaceCaslAction) {
    const database = await this.service.getOrThrow(body?.databaseId, workspace.id);
    await this.assertCan(user, database.spaceId, action);
    return database;
  }

  private async assertCan(user: User, spaceId: string, action: SpaceCaslAction) {
    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(action, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
  }
}
