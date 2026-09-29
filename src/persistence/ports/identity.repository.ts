export interface UserRecord { userId: string }
export type InsertUserInput = UserRecord;
export interface IdentityRepository {
  ensureUser(userId: string): Promise<void>;
  userExists(userId: string): Promise<boolean>;
}
