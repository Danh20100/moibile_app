import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import { PropertyService } from '../../property/services/property.service';
import { RoomService } from '../../room/services/room.service';
import { OnboardingBatch } from '../contracts';
import { ConfirmOnboardingBatchDto, CreateOnboardingBatchDto } from '../dto';

@Injectable()
export class OnboardingService {
  private readonly batches = new Map<string, OnboardingBatch>();

  constructor(
    @Optional() @Inject(PropertyService) private readonly propertyService?: PropertyService,
    @Optional() @Inject(RoomService) private readonly roomService?: RoomService,
  ) {}

  async validateAndPreview(dto: CreateOnboardingBatchDto): Promise<OnboardingBatch> {
    const id = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const roomNumbers = new Set<string>();
    for (const r of dto.rooms) {
      if (roomNumbers.has(r.roomNumber)) {
        throw new BadRequestException(
          `Phát hiện trùng lặp số phòng trong danh sách: ${r.roomNumber}`,
        );
      }
      roomNumbers.add(r.roomNumber);
    }

    const batch: OnboardingBatch = {
      id,
      organizationId: dto.organizationId,
      propertyName: dto.propertyName,
      propertyAddress: dto.propertyAddress,
      rooms: dto.rooms.map((r) => ({
        roomNumber: r.roomNumber,
        basePrice: r.basePrice,
        area: r.area,
        maxOccupants: r.maxOccupants,
      })),
      status: 'validated',
      createdAt: now,
      updatedAt: now,
    };
    this.batches.set(id, batch);
    return batch;
  }

  async findById(id: string): Promise<OnboardingBatch> {
    const batch = this.batches.get(id);
    if (!batch) {
      throw new NotFoundException(`Không tìm thấy onboarding batch với id: ${id}`);
    }
    return batch;
  }

  async confirmBatch(dto: ConfirmOnboardingBatchDto): Promise<OnboardingBatch> {
    const batch = await this.findById(dto.batchId);
    if (batch.status === 'confirmed') {
      throw new BadRequestException('Batch này đã được xác nhận và khởi tạo trước đó');
    }

    if (!this.propertyService || !this.roomService) {
      throw new InternalServerErrorException('Onboarding destination services are unavailable');
    }

    const createdProperty = await this.propertyService.create({
      organizationId: batch.organizationId,
      name: batch.propertyName,
      operationalAddressText: batch.propertyAddress,
      operationalLocation: { latitude: 0, longitude: 0 },
      publicLocationProjection: { latitude: 0, longitude: 0 },
    });

    const createdRoomIds: string[] = [];
    for (const r of batch.rooms) {
      const room = await this.roomService.create({
        propertyId: createdProperty.id,
        roomNumber: r.roomNumber,
        basePrice: r.basePrice,
        area: r.area,
        maxOccupants: r.maxOccupants,
      });
      createdRoomIds.push(room.id);
    }

    const updated: OnboardingBatch = {
      ...batch,
      status: 'confirmed',
      createdPropertyId: createdProperty.id,
      createdRoomIds,
      updatedAt: new Date().toISOString(),
    };
    this.batches.set(dto.batchId, updated);
    return updated;
  }
}
