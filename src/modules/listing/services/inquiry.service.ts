import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateInquiryInput, Inquiry } from '../contracts';
import { ListingService } from './listing.service';

@Injectable()
export class InquiryService {
  private readonly inquiries = new Map<string, Inquiry>();

  constructor(private readonly listingService: ListingService) {}

  async create(input: CreateInquiryInput): Promise<Inquiry> {
    await this.listingService.findById(input.listingId);
    const inquiry: Inquiry = {
      id: randomUUID(),
      listingId: input.listingId,
      senderUserId: input.senderUserId,
      contactIntentOrMessage: input.contactIntentOrMessage,
      status: input.status,
      createdAt: new Date().toISOString(),
    };
    this.inquiries.set(inquiry.id, structuredClone(inquiry));
    return structuredClone(inquiry);
  }

  async findById(id: string): Promise<Inquiry> {
    const inquiry = this.inquiries.get(id);
    if (!inquiry) {
      throw new NotFoundException(`Inquiry not found: ${id}`);
    }
    return structuredClone(inquiry);
  }

  async findByListingId(listingId: string): Promise<Inquiry[]> {
    return Array.from(this.inquiries.values())
      .filter((inquiry) => inquiry.listingId === listingId)
      .map((inquiry) => structuredClone(inquiry));
  }
}
