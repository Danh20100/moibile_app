import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import { OrganizationService } from '../../organization/services/organization.service';
import {
  GeoPoint,
  PropertyArchiveBlockers,
  PropertyProfile,
} from '../contracts';
import { CreatePropertyDto, UpdatePropertyDto } from '../dto';

function clonePoint(point: GeoPoint): GeoPoint {
  return { latitude: point.latitude, longitude: point.longitude };
}

function assertValidPoint(point: GeoPoint, label: string): void {
  if (
    typeof point.latitude !== 'number' ||
    typeof point.longitude !== 'number' ||
    Number.isNaN(point.latitude) ||
    Number.isNaN(point.longitude)
  ) {
    throw new BadRequestException(`${label} must provide numeric latitude/longitude`);
  }
  if (point.latitude < -90 || point.latitude > 90) {
    throw new BadRequestException(`${label} latitude must be within [-90, 90]`);
  }
  if (point.longitude < -180 || point.longitude > 180) {
    throw new BadRequestException(`${label} longitude must be within [-180, 180]`);
  }
}

@Injectable()
export class PropertyService {
  private readonly properties = new Map<string, PropertyProfile>();

  constructor(
    @Optional()
    @Inject(OrganizationService)
    private readonly organizationService?: OrganizationService,
  ) {}

  async create(dto: CreatePropertyDto): Promise<PropertyProfile> {
    if (this.organizationService) {
      await this.organizationService.findById(dto.organizationId);
    }

    assertValidPoint(dto.operationalLocation, 'operationalLocation');
    assertValidPoint(dto.publicLocationProjection, 'publicLocationProjection');

    const id = `prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const property: PropertyProfile = {
      id,
      organizationId: dto.organizationId,
      name: dto.name,
      lifecycleStatus: 'active',
      operationalAddressText: dto.operationalAddressText,
      operationalLocation: clonePoint(dto.operationalLocation),
      publicLocationProjection: clonePoint(dto.publicLocationProjection),
      createdAt: now,
      updatedAt: now,
    };
    this.properties.set(id, structuredClone(property));
    return structuredClone(property);
  }

  async findById(id: string): Promise<PropertyProfile> {
    const prop = this.properties.get(id);
    if (!prop) {
      throw new NotFoundException(`Không tìm thấy property với id: ${id}`);
    }
    return structuredClone(prop);
  }

  async findByOrganizationId(organizationId?: string): Promise<PropertyProfile[]> {
    const all = Array.from(this.properties.values());
    const filtered = organizationId
      ? all.filter((p) => p.organizationId === organizationId)
      : all;
    return filtered.map((p) => structuredClone(p));
  }

  async update(id: string, dto: UpdatePropertyDto): Promise<PropertyProfile> {
    const prop = await this.findById(id);

    if (dto.operationalLocation) {
      assertValidPoint(dto.operationalLocation, 'operationalLocation');
    }
    if (dto.publicLocationProjection) {
      assertValidPoint(dto.publicLocationProjection, 'publicLocationProjection');
    }

    const updated: PropertyProfile = {
      id: prop.id,
      organizationId: prop.organizationId,
      name: dto.name ?? prop.name,
      lifecycleStatus: prop.lifecycleStatus,
      operationalAddressText: dto.operationalAddressText ?? prop.operationalAddressText,
      operationalLocation: dto.operationalLocation
        ? clonePoint(dto.operationalLocation)
        : clonePoint(prop.operationalLocation),
      publicLocationProjection: dto.publicLocationProjection
        ? clonePoint(dto.publicLocationProjection)
        : clonePoint(prop.publicLocationProjection),
      createdAt: prop.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.properties.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async archive(id: string, blockers: PropertyArchiveBlockers): Promise<PropertyProfile> {
    const prop = await this.findById(id);
    if (prop.lifecycleStatus !== 'active') {
      throw new BadRequestException('Archived Property is terminal and cannot be archived again');
    }

    const activeBlockers = Object.entries(blockers)
      .filter(([, value]) => value === true)
      .map(([key]) => key);
    if (activeBlockers.length > 0) {
      throw new BadRequestException(
        `Property archive blocked by: ${activeBlockers.join(', ')}`,
      );
    }

    const archived: PropertyProfile = {
      ...prop,
      lifecycleStatus: 'archived',
      updatedAt: new Date().toISOString(),
    };
    this.properties.set(id, structuredClone(archived));
    return structuredClone(archived);
  }
}
