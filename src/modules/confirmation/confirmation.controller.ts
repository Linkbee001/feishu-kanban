import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../common/auth/admin-auth.guard';
import { ConfirmationService } from './confirmation.service';

@UseGuards(AdminAuthGuard)
@Controller('internal/confirmations')
export class ConfirmationController {
  constructor(private readonly confirmations: ConfirmationService) {}

  @Post(':id/confirm')
  confirm(@Param('id') id: string) {
    return this.confirmations.confirm(id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string) {
    return this.confirmations.reject(id);
  }
}
