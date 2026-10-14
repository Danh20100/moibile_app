import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PropertyRecord } from '../../../persistence/ports/property.repository';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { OrganizationService } from '../../organization/services/organization.service';
import { GeoPoint, PropertyArchiveBlockers, PropertyProfile } from '../contracts';
import { CreatePropertyDto, UpdatePropertyDto } from '../dto';

function assertValidPoint(point: GeoPoint, label: string): void {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) throw new BadRequestException(`${label} must provide numeric latitude/longitude`);
  if (point.latitude < -90 || point.latitude > 90) throw new BadRequestException(`${label} latitude must be within [-90, 90]`);
  if (point.longitude < -180 || point.longitude > 180) throw new BadRequestException(`${label} longitude must be within [-180, 180]`);
}
function profile(row: PropertyRecord): PropertyProfile {
  return { id: row.propertyId, organizationId: row.organizationId, name: row.name, lifecycleStatus: row.lifecycleStatus.toLowerCase() as PropertyProfile['lifecycleStatus'], operationalAddressText: row.operationalAddressText, operationalLocation: structuredClone(row.operationalLocation), publicLocationProjection: structuredClone(row.publicLocationProjection) };
}

@Injectable()
export class PropertyService {
  constructor(@Inject(OrganizationService) private readonly organizationService: OrganizationService, @Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager) {}
  async create(dto: CreatePropertyDto): Promise<PropertyProfile> {
    await this.organizationService.findById(dto.organizationId); assertValidPoint(dto.operationalLocation, 'operationalLocation'); assertValidPoint(dto.publicLocationProjection, 'publicLocationProjection');
    if (dto.id) {
      const existing = await this.transactions.run(({ repositories }) => repositories.property.findProperty(dto.id!));
      if (existing) {
        if (existing.organizationId !== dto.organizationId) throw new BadRequestException('Property request ID already belongs to a different Organization');
        if (existing.name !== dto.name || existing.operationalAddressText !== dto.operationalAddressText ||
            existing.operationalLocation.latitude !== dto.operationalLocation.latitude || existing.operationalLocation.longitude !== dto.operationalLocation.longitude ||
            existing.publicLocationProjection.latitude !== dto.publicLocationProjection.latitude || existing.publicLocationProjection.longitude !== dto.publicLocationProjection.longitude) {
          throw new BadRequestException('Property request ID was already used with a different payload');
        }
        return profile(existing);
      }
    }
    const value: PropertyProfile = { id: dto.id ?? randomUUID(), organizationId: dto.organizationId, name: dto.name, lifecycleStatus: 'active', operationalAddressText: dto.operationalAddressText, operationalLocation: structuredClone(dto.operationalLocation), publicLocationProjection: structuredClone(dto.publicLocationProjection) };
    await this.transactions.run(({ repositories }) => repositories.property.createProperty({ propertyId: value.id, organizationId: value.organizationId, name: value.name, lifecycleStatus: 'ACTIVE', operationalAddressText: value.operationalAddressText, operationalLocation: value.operationalLocation, publicLocationProjection: value.publicLocationProjection }));
    const committed = await this.transactions.run(({ repositories }) => repositories.property.findProperty(value.id));
    if (!committed || committed.organizationId !== value.organizationId || committed.name !== value.name ||
        committed.operationalAddressText !== value.operationalAddressText ||
        committed.operationalLocation.latitude !== value.operationalLocation.latitude || committed.operationalLocation.longitude !== value.operationalLocation.longitude ||
        committed.publicLocationProjection.latitude !== value.publicLocationProjection.latitude || committed.publicLocationProjection.longitude !== value.publicLocationProjection.longitude) {
      throw new BadRequestException('Property request ID was already used with a different payload');
    }
    return profile(committed);
  }
  async findById(id: string): Promise<PropertyProfile> { const row = await this.transactions.run(({ repositories }) => repositories.property.findProperty(id)); if (!row) throw new NotFoundException(`Không tìm thấy property với id: ${id}`); return profile(row); }
  async findByOrganizationId(organizationId?: string): Promise<PropertyProfile[]> { return (await this.transactions.run(({ repositories }) => repositories.property.findPropertiesByOrganization(organizationId))).map(profile); }
  async update(id: string, dto: UpdatePropertyDto): Promise<PropertyProfile> {
    if (dto.operationalLocation) assertValidPoint(dto.operationalLocation, 'operationalLocation'); if (dto.publicLocationProjection) assertValidPoint(dto.publicLocationProjection, 'publicLocationProjection');
    return this.transactions.run(async ({ repositories }) => { const current = await repositories.property.findProperty(id); if (!current) throw new NotFoundException(`Không tìm thấy property với id: ${id}`); if (current.lifecycleStatus !== 'ACTIVE') throw new BadRequestException('Archived Property cannot be edited'); const updated: PropertyRecord = { ...current, name: dto.name ?? current.name, operationalAddressText: dto.operationalAddressText ?? current.operationalAddressText, operationalLocation: dto.operationalLocation ?? current.operationalLocation, publicLocationProjection: dto.publicLocationProjection ?? current.publicLocationProjection }; await repositories.property.updateProperty(updated); return profile(updated); });
  }
  async archive(id: string, blockers: PropertyArchiveBlockers): Promise<PropertyProfile> {
    const active = Object.entries(blockers).filter(([, value]) => value).map(([key]) => key); if (active.length) throw new BadRequestException(`Property archive blocked by: ${active.join(', ')}`);
    return this.transactions.run(async ({ repositories }) => { const current = await repositories.property.findProperty(id); if (!current) throw new NotFoundException(`Không tìm thấy property với id: ${id}`); if (current.lifecycleStatus !== 'ACTIVE') throw new BadRequestException('Archived Property is terminal and cannot be archived again'); const updated = { ...current, lifecycleStatus: 'ARCHIVED' }; await repositories.property.updateProperty(updated); return profile(updated); });
  }
}
