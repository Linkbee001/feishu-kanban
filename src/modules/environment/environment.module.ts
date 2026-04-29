import { Module } from '@nestjs/common';
import { EnvironmentController } from './environment.controller';
import { EnvironmentService } from './environment.service';
import { RepoModule } from '../repo/repo.module';

@Module({
  imports: [RepoModule],
  controllers: [EnvironmentController],
  providers: [EnvironmentService],
  exports: [EnvironmentService],
})
export class EnvironmentModule {}
