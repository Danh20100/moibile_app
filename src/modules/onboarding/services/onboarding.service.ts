import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { OnboardingBatch } from '../contracts';
import { ConfirmOnboardingBatchDto, CreateOnboardingBatchDto } from '../dto';

@Injectable()
export class OnboardingService {
  private readonly batches = new Map<string, OnboardingBatch>();

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

    const mockPropertyId = `prop_onboard_${Date.now()}`;
    const mockRoomIds = batch.rooms.map((_, index) => `room_onboard_${Date.now()}_${index + 1}`);

    const updated: OnboardingBatch = {
      ...batch,
      status: 'confirmed',
      createdPropertyId: mockPropertyId,
      createdRoomIds: mockRoomIds,
      updatedAt: new Date().toISOString(),
    };
    this.batches.set(dto.batchId, updated);
    return updated;
  }
}
