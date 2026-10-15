import type { TransactionManager } from '../ports/transaction-manager';
import type { RoomRecord } from '../ports/property.repository';

export class RentalGuardViolation extends Error {
  constructor(readonly guard: string, message: string) { super(message); this.name = RentalGuardViolation.name; }
}

const allowedRoomTransitions: Record<string, readonly string[]> = {
  VACANT: ['OCCUPIED', 'MAINTENANCE', 'INACTIVE'], OCCUPIED: ['VACANT'],
  MAINTENANCE: ['VACANT', 'INACTIVE'], INACTIVE: ['VACANT'],
};

export class RentalTransactionCoordinator {
  constructor(private readonly transactions: TransactionManager) {}
  private fail(guard: string, message: string): never { throw new RentalGuardViolation(guard, message); }

  async publishListing(listingId: string): Promise<void> { await this.transactions.run(async ({repositories:r}) => {
    const listing=await r.listing.findListing(listingId); if(!listing)this.fail('listing_publish_eligibility','Listing not found');
    const room=await r.property.findRoom(listing.roomId); if(!room)this.fail('listing_publish_eligibility','Room not found');
    await r.property.lockProperty(room.propertyId); await r.property.lockRoom(room.roomId);
    const property=await r.property.findProperty(room.propertyId); const fresh=await r.property.findRoom(room.roomId);
    if(property?.lifecycleStatus!=='ACTIVE'||fresh?.recordLifecycle!=='ACTIVE'||fresh.operationalState!=='VACANT')this.fail('listing_publish_eligibility','Listing is not eligible to publish');
    listing.status='PUBLISHED'; await r.listing.updateListing(listing);
  }); }

  async createTenancy(input: Parameters<import('../ports/tenancy.repository').TenancyRepository['createTenancy']>[0]): Promise<void> { await this.transactions.run(async({repositories:r})=>{
    const room=await r.property.findRoom(input.roomId);if(!room)this.fail('tenancy_activation','Room not found');await r.property.lockProperty(room.propertyId);await r.property.lockRoom(room.roomId);
    const property=await r.property.findProperty(room.propertyId);if(property?.lifecycleStatus!=='ACTIVE'||room.recordLifecycle!=='ACTIVE'||(await r.tenancy.findNonterminalByRoom(room.roomId)).length)this.fail('tenancy_activation','Room cannot accept a tenancy');
    await r.tenancy.createTenancy(input);
  }); }

  async activateTenancy(tenancyId:string):Promise<void>{await this.transactions.run(async({repositories:r})=>{
    const tenancy=await r.tenancy.findTenancy(tenancyId);if(!tenancy)this.fail('tenancy_activation','Tenancy not found');const room=await r.property.findRoom(tenancy.roomId);if(!room)this.fail('tenancy_activation','Room not found');
    await r.property.lockProperty(room.propertyId);await r.property.lockRoom(room.roomId);await r.tenancy.lockTenancy(tenancyId);
    const property=await r.property.findProperty(room.propertyId),fresh=await r.property.findRoom(room.roomId),others=(await r.tenancy.findNonterminalByRoom(room.roomId)).filter(x=>x.tenancyId!==tenancyId);
    if(tenancy.status!=='DRAFT'||property?.lifecycleStatus!=='ACTIVE'||fresh?.recordLifecycle!=='ACTIVE'||fresh.operationalState!=='VACANT'||others.length||!(await r.tenancy.findActivePrimary(tenancyId)))this.fail('tenancy_activation','Tenancy is not eligible to activate');
    tenancy.status='ACTIVE';tenancy.startedAt??=new Date().toISOString();fresh.operationalState='OCCUPIED';await r.tenancy.updateTenancy(tenancy);await r.property.updateRoom(fresh);await this.unpublish(r,fresh.roomId);
  });}

  async changeRoomOperationalState(roomId:string,to:string):Promise<void>{await this.transactions.run(async({repositories:r})=>{const room=await r.property.findRoom(roomId);if(!room)this.fail('room_leave_vacant_unpublish','Room not found');await r.property.lockProperty(room.propertyId);await r.property.lockRoom(roomId);const fresh=await r.property.findRoom(roomId),property=await r.property.findProperty(room.propertyId);if(!fresh||fresh.recordLifecycle!=='ACTIVE'||property?.lifecycleStatus!=='ACTIVE'||!allowedRoomTransitions[fresh.operationalState]?.includes(to)||fresh.operationalState==='OCCUPIED')this.fail('room_leave_vacant_unpublish','Illegal Room transition');if((await r.tenancy.findNonterminalByRoom(roomId)).some(x=>x.status==='ACTIVE'||x.status==='ENDING'))this.fail('room_leave_vacant_unpublish','Active tenancy blocks transition');fresh.operationalState=to;await r.property.updateRoom(fresh);if(to!=='VACANT')await this.unpublish(r,roomId);});}

  async checkoutTenancy(tenancyId:string,endReason:string,endedAt=new Date().toISOString()):Promise<void>{await this.transactions.run(async({repositories:r})=>{const tenancy=await r.tenancy.findTenancy(tenancyId);if(!tenancy)this.fail('tenancy_checkout','Tenancy not found');const room=await r.property.findRoom(tenancy.roomId);if(!room)this.fail('tenancy_checkout','Room not found');await r.property.lockProperty(room.propertyId);await r.property.lockRoom(room.roomId);await r.tenancy.lockTenancy(tenancyId);if(tenancy.status!=='ENDING'||room.operationalState!=='OCCUPIED')this.fail('tenancy_checkout','Checkout requires ENDING/OCCUPIED');tenancy.status='ENDED';tenancy.endedAt=endedAt;tenancy.endReason=endReason;room.operationalState='VACANT';await r.tenancy.updateTenancy(tenancy);await r.property.updateRoom(room);await this.unpublish(r,room.roomId);});}

  async archiveRoom(roomId:string):Promise<void>{await this.transactions.run(async({repositories:r})=>{const room=await r.property.findRoom(roomId);if(!room)this.fail('room_archive_guard','Room not found');await r.property.lockProperty(room.propertyId);await r.property.lockRoom(roomId);const fresh=await r.property.findRoom(roomId);if(!fresh||fresh.recordLifecycle!=='ACTIVE'||!['VACANT','MAINTENANCE','INACTIVE'].includes(fresh.operationalState))this.fail('room_archive_guard','Room cannot be archived in its current state');await this.assertRoomArchivable(r,fresh);fresh.operationalState='INACTIVE';fresh.recordLifecycle='ARCHIVED';await this.archiveListing(r,roomId);await r.property.updateRoom(fresh);});}
  async archiveProperty(propertyId:string):Promise<void>{await this.transactions.run(async({repositories:r})=>{await r.property.lockProperty(propertyId);const property=await r.property.findProperty(propertyId);if(!property)this.fail('property_archive_guard','Property not found');const rooms=await r.property.findRoomsByProperty(propertyId);for(const room of rooms)await r.property.lockRoom(room.roomId);for(const room of rooms){if(room.recordLifecycle!=='ARCHIVED'&&room.operationalState!=='INACTIVE')this.fail('property_archive_guard','Child Room is not inactive');await this.assertRoomArchivable(r,room);const listing=await r.listing.findCurrentListingByRoom(room.roomId);if(listing?.status==='PUBLISHED')this.fail('property_archive_guard','Published Listing blocks archive');if(listing)await this.archiveListing(r,room.roomId);}property.lifecycleStatus='ARCHIVED';await r.property.updateProperty(property);});}
  private async assertRoomArchivable(r: Parameters<Parameters<TransactionManager['run']>[0]>[0]['repositories'],room:RoomRecord){if((await r.tenancy.findTenanciesByRoom(room.roomId)).length||(await r.incident.findOpenIncidentsByRoom(room.roomId)).length)this.fail('open_incident_archive_blocker','Room is not archivable while Tenancy or incident history requires retention review');}
  private async unpublish(r:Parameters<Parameters<TransactionManager['run']>[0]>[0]['repositories'],roomId:string){const listing=await r.listing.findCurrentListingByRoom(roomId);if(listing?.status==='PUBLISHED'){listing.status='UNPUBLISHED';await r.listing.updateListing(listing);}}
  private async archiveListing(r:Parameters<Parameters<TransactionManager['run']>[0]>[0]['repositories'],roomId:string){const listing=await r.listing.findCurrentListingByRoom(roomId);if(listing){if(listing.status==='PUBLISHED'){listing.status='UNPUBLISHED';await r.listing.updateListing(listing);}listing.status='ARCHIVED';await r.listing.updateListing(listing);}}
}
