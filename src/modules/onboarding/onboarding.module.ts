import { Module } from '@nestjs/common';

import { PropertyModule } from '../property/property.module';
import { RoomModule } from '../room/room.module';
import { OnboardingController } from './controllers/onboarding.controller';
import { OnboardingService } from './services/onboarding.service';

@Module({
  imports: [PropertyModule, RoomModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
