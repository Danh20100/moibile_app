import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { CreateInquiryInput, Inquiry } from '../contracts';
import { ListingService } from './listing.service';
const inquiry = (row: { inquiryId: string; listingId: string; senderUserId: string | null; contactIntentOrMessage: string; status: string; createdAt: string }): Inquiry => ({ id: row.inquiryId, listingId: row.listingId, senderUserId: row.senderUserId ?? undefined, contactIntentOrMessage: row.contactIntentOrMessage, status: row.status, createdAt: row.createdAt });
@Injectable()
export class InquiryService {
  constructor(private readonly listingService: ListingService, @Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager) {}
  async create(input: CreateInquiryInput): Promise<Inquiry> { await this.listingService.findById(input.listingId); const value: Inquiry = { id: randomUUID(), ...input, senderUserId: input.senderUserId, createdAt: new Date().toISOString() }; await this.transactions.run(({ repositories }) => repositories.listing.createInquiry({ inquiryId: value.id, listingId: value.listingId, senderUserId: value.senderUserId ?? null, contactIntentOrMessage: value.contactIntentOrMessage, status: value.status, createdAt: value.createdAt })); return value; }
  async findById(id: string): Promise<Inquiry> { const row = await this.transactions.run(({ repositories }) => repositories.listing.findInquiry(id)); if (!row) throw new NotFoundException(`Inquiry not found: ${id}`); return inquiry(row); }
  async findByListingId(listingId: string): Promise<Inquiry[]> { return (await this.transactions.run(({ repositories }) => repositories.listing.findInquiriesByListing(listingId))).map(inquiry); }
}
