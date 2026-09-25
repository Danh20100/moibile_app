import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import { PropertyService } from '../../property/services/property.service';
import { RoomService } from '../../room/services/room.service';
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
  private static readonly listings = new Map<string, ListingContent>();

  constructor(
    @Optional() @Inject(RoomService) private readonly roomService?: RoomService,
    @Optional() @Inject(PropertyService) private readonly propertyService?: PropertyService,
  ) {}

  async create(dto: CreateListingDto): Promise<ListingContent> {
    if (this.roomService) {
      await this.roomService.findById(dto.roomId);
    }
    if (this.propertyService) {
      await this.propertyService.findById(dto.propertyId);
    }

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
    ListingService.listings.set(id, listing);
    return { ...listing };
  }

  async findById(id: string): Promise<ListingContent> {
    const listing = ListingService.listings.get(id);
    if (!listing) {
      throw new NotFoundException(`Không tìm thấy listing với id: ${id}`);
    }
    return { ...listing };
  }

  async findPublic(propertyId?: string): Promise<ListingContent[]> {
    const all = Array.from(ListingService.listings.values());
    return all
      .filter((l) => {
        const matchProperty = !propertyId || l.propertyId === propertyId;
        return matchProperty && l.status === 'published';
      })
      .map((l) => ({ ...l }));
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
    ListingService.listings.set(id, updated);
    return { ...updated };
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
    ListingService.listings.set(id, updated);
    return { ...updated };
  }
}
