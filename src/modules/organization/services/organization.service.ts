import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '../../../persistence/ports/transaction-manager';
import { OrganizationProfile } from '../contracts';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../dto';

@Injectable()
export class OrganizationService {
  constructor(@Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager) {}

  async create(dto: CreateOrganizationDto): Promise<OrganizationProfile> {
    if (!dto.primaryOwnerUserId) {
      throw new BadRequestException('primaryOwnerUserId là bắt buộc');
    }
    const value: OrganizationProfile = {
      id: randomUUID(),
      name: dto.name,
      primaryOwnerUserId: dto.primaryOwnerUserId,
    };
    await this.transactions.run(({ repositories }) =>
      repositories.organization.createOrganization({
        organizationId: value.id,
        name: value.name,
        primaryOwnerUserId: value.primaryOwnerUserId,
      }),
    );
    return structuredClone(value);
  }

  async findById(id: string): Promise<OrganizationProfile> {
    const row = await this.transactions.run(({ repositories }) =>
      repositories.organization.findOrganization(id),
    );
    if (!row) throw new NotFoundException(`Không tìm thấy organization với id: ${id}`);
    return { id: row.organizationId, name: row.name, primaryOwnerUserId: row.primaryOwnerUserId };
  }

  async findAll(): Promise<OrganizationProfile[]> {
    const rows = await this.transactions.run(({ repositories }) =>
      repositories.organization.findOrganizations(),
    );
    return rows.map((row) => ({
      id: row.organizationId,
      name: row.name,
      primaryOwnerUserId: row.primaryOwnerUserId,
    }));
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationProfile> {
    return this.transactions.run(async ({ repositories }) => {
      const row = await repositories.organization.findOrganization(id);
      if (!row) throw new NotFoundException(`Không tìm thấy organization với id: ${id}`);
      const updated = { ...row, name: dto.name ?? row.name };
      await repositories.organization.updateOrganization(updated);
      return {
        id: updated.organizationId,
        name: updated.name,
        primaryOwnerUserId: updated.primaryOwnerUserId,
      };
    });
  }
}
