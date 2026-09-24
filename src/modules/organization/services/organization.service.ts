import { Injectable, NotFoundException } from '@nestjs/common';

import { OrganizationProfile } from '../contracts';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../dto';

@Injectable()
export class OrganizationService {
  private readonly organizations = new Map<string, OrganizationProfile>();

  async create(dto: CreateOrganizationDto): Promise<OrganizationProfile> {
    const id = `org_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const org: OrganizationProfile = {
      id,
      name: dto.name,
      description: dto.description,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.organizations.set(id, org);
    return org;
  }

  async findById(id: string): Promise<OrganizationProfile> {
    const org = this.organizations.get(id);
    if (!org) {
      throw new NotFoundException(`Không tìm thấy organization với id: ${id}`);
    }
    return org;
  }

  async findAll(): Promise<OrganizationProfile[]> {
    return Array.from(this.organizations.values());
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationProfile> {
    const org = await this.findById(id);
    const updated: OrganizationProfile = {
      ...org,
      name: dto.name ?? org.name,
      description: dto.description ?? org.description,
      status: dto.status ?? org.status,
      updatedAt: new Date().toISOString(),
    };
    this.organizations.set(id, updated);
    return updated;
  }
}
