import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';

import { OrganizationService } from '../../organization/services/organization.service';
import { PropertyProfile } from '../contracts';
import { CreatePropertyDto, UpdatePropertyDto } from '../dto';

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

    const id = `prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const property: PropertyProfile = {
      id,
      organizationId: dto.organizationId,
      name: dto.name,
      location: {
        address: dto.address,
        ward: dto.ward,
        district: dto.district,
        city: dto.city,
      },
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.properties.set(id, property);
    return { ...property, location: { ...property.location } };
  }

  async findById(id: string): Promise<PropertyProfile> {
    const prop = this.properties.get(id);
    if (!prop) {
      throw new NotFoundException(`Không tìm thấy property với id: ${id}`);
    }
    return { ...prop, location: { ...prop.location } };
  }

  async findByOrganizationId(organizationId?: string): Promise<PropertyProfile[]> {
    const all = Array.from(this.properties.values());
    if (!organizationId) {
      return all.map((p) => ({ ...p, location: { ...p.location } }));
    }
    return all
      .filter((p) => p.organizationId === organizationId)
      .map((p) => ({ ...p, location: { ...p.location } }));
  }

  async update(id: string, dto: UpdatePropertyDto): Promise<PropertyProfile> {
    const prop = await this.findById(id);
    const updated: PropertyProfile = {
      ...prop,
      name: dto.name ?? prop.name,
      location: {
        address: dto.address ?? prop.location.address,
        ward: dto.ward ?? prop.location.ward,
        district: dto.district ?? prop.location.district,
        city: dto.city ?? prop.location.city,
      },
      status: dto.status ?? prop.status,
      updatedAt: new Date().toISOString(),
    };
    this.properties.set(id, updated);
    return { ...updated, location: { ...updated.location } };
  }
}
