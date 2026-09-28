export interface UserRecord { user_id: string }
export interface InsertUserInput extends UserRecord {}
export interface IdentityRepository {
  insertUser(userId: string): Promise<void>;
  userExists(userId: string): Promise<boolean>;
}
