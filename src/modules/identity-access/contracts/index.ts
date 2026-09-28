export interface UserReference {
  userId: string;
}

export interface UserProfile {
  id: string;
  externalSubject: string;
  email?: string;
  name?: string;
  pictureUrl?: string;
  createdAt: string;
  updatedAt: string;
}
