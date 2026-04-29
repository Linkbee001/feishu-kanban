import { Injectable } from '@nestjs/common';
import { GroupAgentSession } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProjectContextBundle } from '../agent/agent.types';
import { ProjectRuntimeContextService } from '../agent/project-runtime-context.service';

@Injectable()
export class ProjectContextAssembler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeContext: ProjectRuntimeContextService,
  ) {}

  async assembleForSession(session: GroupAgentSession): Promise<ProjectContextBundle> {
    if (!session.projectId) {
      throw new Error(`Group session ${session.id} is not bound to a project`);
    }
    const environmentId = session.activeEnvironmentId ?? (
      await this.prisma.project.findUniqueOrThrow({
        where: { id: session.projectId },
        select: { defaultEnvironmentId: true },
      })
    ).defaultEnvironmentId;
    if (!environmentId) {
      throw new Error(`Project ${session.projectId} has no default environment`);
    }
    return this.runtimeContext.assemble({
      projectId: session.projectId,
      environmentId,
      runtimeSessionKey: session.runtimeSessionKey,
      sessionMode: session.sessionMode,
      sessionStatus: this.runtimeContext.toSessionStatus(session.status),
      memorySummary: session.memorySummary,
    });
  }
}
