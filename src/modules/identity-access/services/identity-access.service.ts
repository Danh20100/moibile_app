import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { googlePrincipalUserId } from '../../../common/identity/deterministic-user-id';
import { createGoogleIdTokenVerifierFromEnv, GoogleIdentityVerificationError, type GoogleIdTokenVerifier } from '../../../integrations/google-identity';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { UserReference, VerifiedPrincipal } from '../contracts';
import { VerifyGoogleTokenDto } from '../dto';

@Injectable()
export class IdentityAccessService {
  private verifier?: GoogleIdTokenVerifier;

  constructor(@Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager) {
    try { this.verifier = createGoogleIdTokenVerifierFromEnv(); } catch { this.verifier = undefined; }
  }

  async authenticateWithGoogle(dto: VerifyGoogleTokenDto): Promise<VerifiedPrincipal> {
    if (!this.verifier) {
      try { this.verifier = createGoogleIdTokenVerifierFromEnv(); }
      catch { throw new BadRequestException('GOOGLE_CLIENT_ID chưa được cấu hình trên server'); }
    }
    try {
      const identity = await this.verifier.verify(dto.idToken);
      const userId = googlePrincipalUserId(identity.issuer, identity.subject);
      await this.transactions.run(({ repositories }) => repositories.identity.ensureUser(userId));
      return { userId, provider: 'google', ...identity };
    } catch (error) {
      if (error instanceof GoogleIdentityVerificationError) throw new UnauthorizedException(`Xác thực Google thất bại: ${error.code} - ${error.message}`);
      throw error;
    }
  }

  async findUserById(userId: string): Promise<UserReference> {
    const exists = await this.transactions.run(({ repositories }) => repositories.identity.userExists(userId));
    if (!exists) throw new NotFoundException(`Không tìm thấy user với id: ${userId}`);
    return { userId };
  }
}
