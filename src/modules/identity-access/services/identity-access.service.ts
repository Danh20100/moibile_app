import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';

import {
  GOOGLE_ID_TOKEN_VERIFIER,
  verifyGoogleIdToken,
  type GoogleIdTokenVerifier,
} from '../../../integrations/google-identity';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { UserReference, VerifiedPrincipal } from '../contracts';
import { VerifyGoogleTokenDto } from '../dto';

@Injectable()
export class IdentityAccessService {
  private verifier?: GoogleIdTokenVerifier;

  constructor(
    @Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    @Optional() @Inject(GOOGLE_ID_TOKEN_VERIFIER) verifier?: GoogleIdTokenVerifier,
  ) {
    this.verifier = verifier;
  }

  async authenticateWithGoogle(dto: VerifyGoogleTokenDto): Promise<VerifiedPrincipal> {
    const principal = await verifyGoogleIdToken(this.verifier, dto.idToken);
    await this.transactions.run(({ repositories }) => repositories.identity.ensureUser(principal.userId));
    return principal;
  }

  async findUserById(userId: string): Promise<UserReference> {
    const exists = await this.transactions.run(({ repositories }) => repositories.identity.userExists(userId));
    if (!exists) throw new NotFoundException(`Không tìm thấy user với id: ${userId}`);
    return { userId };
  }
}
