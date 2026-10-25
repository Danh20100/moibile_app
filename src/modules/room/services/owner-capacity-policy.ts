import { ConflictException, ServiceUnavailableException } from '@nestjs/common';

/**
 * The first managed room is free. Each unexpired, provider-verified entitlement
 * permits exactly one additional active room, across all the owner's organizations.
 *
 * This check is used within the PostgreSQL transaction that inserts the room.
 */
export function assertOwnerRoomCapacity(used: number, verifiedEntitlements: number): void {
  if (
    !Number.isSafeInteger(used) ||
    used < 0 ||
    !Number.isSafeInteger(verifiedEntitlements) ||
    verifiedEntitlements < 0
  ) {
    throw new ServiceUnavailableException('Room capacity could not be verified');
  }
  if (used >= 1 + verifiedEntitlements) {
    throw new ConflictException('Không còn chỗ quản lý. Vui lòng mua thêm slot.');
  }
}
