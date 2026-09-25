import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  createGoogleIdTokenVerifierFromEnv,
  GoogleIdentityVerificationError,
  type GoogleIdTokenVerifier,
} from '../../../integrations/google-identity';
import { Invitation, UserProfile } from '../contracts';
import { CreateInvitationDto, VerifyGoogleTokenDto } from '../dto';

@Injectable()
export class IdentityAccessService {
  private verifier?: GoogleIdTokenVerifier;
  private readonly users = new Map<string, UserProfile>();
  private readonly usersBySubject = new Map<string, string>();
  private readonly invitations = new Map<string, Invitation>();

  constructor() {
    try {
      this.verifier = createGoogleIdTokenVerifierFromEnv();
    } catch {
      this.verifier = undefined;
    }
  }

  async authenticateWithGoogle(dto: VerifyGoogleTokenDto): Promise<UserProfile> {
    if (!this.verifier) {
      try {
        this.verifier = createGoogleIdTokenVerifierFromEnv();
      } catch {
        throw new BadRequestException('GOOGLE_CLIENT_ID chưa được cấu hình trên server');
      }
    }

    try {
      const googleIdentity = await this.verifier.verify(dto.idToken);
      const existingUserId = this.usersBySubject.get(googleIdentity.subject);

      if (existingUserId) {
        const user = this.users.get(existingUserId)!;
        const updated: UserProfile = {
          ...user,
          name: googleIdentity.name ?? user.name,
          pictureUrl: googleIdentity.pictureUrl ?? user.pictureUrl,
          email: googleIdentity.email ?? user.email,
          updatedAt: new Date().toISOString(),
        };
        this.users.set(existingUserId, updated);
        return updated;
      }

      const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const newUser: UserProfile = {
        id,
        externalSubject: googleIdentity.subject,
        email: googleIdentity.email,
        name: googleIdentity.name,
        pictureUrl: googleIdentity.pictureUrl,
        createdAt: now,
        updatedAt: now,
      };

      this.users.set(id, newUser);
      this.usersBySubject.set(googleIdentity.subject, id);
      return newUser;
    } catch (error) {
      if (error instanceof GoogleIdentityVerificationError) {
        throw new UnauthorizedException(
          `Xác thực Google thất bại: ${error.code} - ${error.message}`,
        );
      }
      throw error;
    }
  }

  async findUserById(id: string): Promise<UserProfile> {
    const user = this.users.get(id);
    if (!user) {
      throw new NotFoundException(`Không tìm thấy user với id: ${id}`);
    }
    return user;
  }

  async createInvitation(dto: CreateInvitationDto): Promise<Invitation> {
    const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const invitation: Invitation = {
      id,
      email: dto.email,
      role: dto.role,
      organizationId: dto.organizationId,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    this.invitations.set(id, invitation);
    return invitation;
  }

  async acceptInvitation(invitationId: string): Promise<Invitation> {
    const inv = this.invitations.get(invitationId);
    if (!inv) {
      throw new NotFoundException(`Không tìm thấy lời mời với id: ${invitationId}`);
    }
    if (inv.status !== 'pending') {
      throw new BadRequestException(
        `Lời mời hiện không ở trạng thái pending (hiện tại: ${inv.status})`,
      );
    }

    if (new Date(inv.expiresAt) < new Date()) {
      inv.status = 'expired';
      throw new BadRequestException('Lời mời đã hết hạn');
    }

    inv.status = 'accepted';
    return inv;
  }
}
