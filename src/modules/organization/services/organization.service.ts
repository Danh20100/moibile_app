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
      primaryOwnerUserId: dto.primaryOwnerUserId,
      createdAt: now,
      updatedAt: now,
    };
    this.organizations.set(id, structuredClone(org));
    return structuredClone(org);
  }

  async findById(id: string): Promise<OrganizationProfile> {
    const org = this.organizations.get(id);
    if (!org) {
      throw new NotFoundException(`Không tìm thấy organization với id: ${id}`);
    }
    return structuredClone(org);
  }

  async findAll(): Promise<OrganizationProfile[]> {
    return Array.from(this.organizations.values()).map((org) => structuredClone(org));
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationProfile> {
    const org = await this.findById(id);
    const updated: OrganizationProfile = {
      id: org.id,
      name: dto.name ?? org.name,
      primaryOwnerUserId: org.primaryOwnerUserId,
      createdAt: org.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.organizations.set(id, structuredClone(updated));
    return structuredClone(updated);
  }
}
