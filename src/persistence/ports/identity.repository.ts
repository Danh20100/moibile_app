export interface UserRecord { userId: string }
export interface InsertUserInput extends UserRecord {}
export interface IdentityRepository {
  insertUser(userId: string): Promise<void>;
  userExists(userId: string): Promise<boolean>;
}
