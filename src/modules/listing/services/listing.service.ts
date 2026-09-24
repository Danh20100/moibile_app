import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { ListingContent, ListingStatus } from '../contracts';
import { CreateListingDto, UpdateListingDto, UpdateListingStatusDto } from '../dto';

const VALID_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  draft: ['published'],
  published: ['hidden', 'rented'],
  hidden: ['published'],
  rented: [],
};

@Injectable()
export class ListingService {
  private readonly listings = new Map<string, ListingContent>();

  async create(dto: CreateListingDto): Promise<ListingContent> {
    const id = `list_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const listing: ListingContent = {
      id,
      roomId: dto.roomId,
      propertyId: dto.propertyId,
      title: dto.title,
      description: dto.description,
      price: dto.price,
      locationSummary: dto.locationSummary,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    this.listings.set(id, listing);
    return listing;
  }

  async findById(id: string): Promise<ListingContent> {
    const listing = this.listings.get(id);
    if (!listing) {
      throw new NotFoundException(`Không tìm thấy listing với id: ${id}`);
    }
    return listing;
  }

  async findPublic(propertyId?: string): Promise<ListingContent[]> {
    const all = Array.from(this.listings.values());
    return all.filter((l) => {
      const matchProperty = !propertyId || l.propertyId === propertyId;
      return matchProperty && l.status === 'published';
    });
  }

  async update(id: string, dto: UpdateListingDto): Promise<ListingContent> {
    const listing = await this.findById(id);
    const updated: ListingContent = {
      ...listing,
      title: dto.title ?? listing.title,
      description: dto.description ?? listing.description,
      price: dto.price ?? listing.price,
      locationSummary: dto.locationSummary ?? listing.locationSummary,
      updatedAt: new Date().toISOString(),
    };
    this.listings.set(id, updated);
    return updated;
  }

  async updateStatus(id: string, dto: UpdateListingStatusDto): Promise<ListingContent> {
    const listing = await this.findById(id);
    const allowed = VALID_TRANSITIONS[listing.status];

    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái listing từ '${listing.status}' sang '${dto.status}'. Chuyển đổi hợp lệ: [${allowed.join(', ')}]`,
      );
    }

    const now = new Date().toISOString();
    const updated: ListingContent = {
      ...listing,
      status: dto.status,
      publishedAt: dto.status === 'published' ? now : listing.publishedAt,
      updatedAt: now,
    };
    this.listings.set(id, updated);
    return updated;
  }
}
