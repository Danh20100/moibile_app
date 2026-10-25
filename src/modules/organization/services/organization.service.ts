import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '../../../persistence/ports/transaction-manager';
import { OrganizationProfile } from '../contracts';
import { UpdateOrganizationDto } from '../dto';

interface CreateOrganizationInput {
  name: string;
  primaryOwnerUserId: string;
}

@Injectable()
export class OrganizationService {
  constructor(@Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager) {}

  async create(dto: CreateOrganizationInput): Promise<OrganizationProfile> {
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

  async createWithReauthentication(dto: CreateOrganizationInput & { reauthProof: string; sessionId: string }): Promise<OrganizationProfile> {
    if (!dto.primaryOwnerUserId || !dto.sessionId || !dto.reauthProof) throw new UnauthorizedException('Fresh reauthentication is required');
    const value: OrganizationProfile = { id: randomUUID(), name: dto.name, primaryOwnerUserId: dto.primaryOwnerUserId };
    const accepted = await this.transactions.run(async ({ repositories }) => {
      const challenge = await repositories.identitySessions.consumeChallenge({
        nonceSha256: createHash('sha256').update(dto.reauthProof).digest('hex'),
        purpose: 'REAUTH_ORGANIZATION_CREATE', now: new Date().toISOString(),
      });
      if (!challenge || challenge.userId !== dto.primaryOwnerUserId || challenge.sessionId !== dto.sessionId) {
        await repositories.identitySessions.appendSecurityEvent({ eventId: randomUUID(), userId: dto.primaryOwnerUserId,
          sessionId: dto.sessionId, eventCode: 'REAUTH_REJECTED', outcome: 'REJECTED', occurredAt: new Date().toISOString(),
          requestMetadata: { operation: 'organization.create' } });
        return false;
      }
      await repositories.organization.createOrganization({ organizationId: value.id, name: value.name,
        primaryOwnerUserId: value.primaryOwnerUserId });
      return true;
    });
    if (!accepted) throw new ForbiddenException('Reauthentication proof is invalid, expired, or already used');
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
