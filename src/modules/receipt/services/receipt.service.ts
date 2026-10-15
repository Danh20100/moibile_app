import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ReceiptRecord as StoredReceipt } from '../../../persistence/ports/finance.repository';
import { FinanceTransactionCoordinator } from '../../../persistence/guards/finance-transaction-coordinator';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { BillingService } from '../../billing/services/billing.service';
import { ReceiptRecord } from '../contracts';

@Injectable()
export class ReceiptService {
  private readonly guard:FinanceTransactionCoordinator;
  constructor(@Inject(BillingService) private readonly billingService:BillingService,@Inject(TRANSACTION_MANAGER) private readonly tx:TransactionManager){this.guard=new FinanceTransactionCoordinator(tx);}
  async issue(paymentId:string):Promise<ReceiptRecord>{const payment=await this.billingService.findPaymentById(paymentId);if(payment.voidedOrReversedAt)throw new BadRequestException('Receipt requires a non-voided confirmed Payment');const all=await this.tx.run(({repositories})=>repositories.finance.findReceiptsForPayment(paymentId));if(all.some(x=>x.status==='ISSUED'))throw new BadRequestException('Payment already has a current Receipt');const value:StoredReceipt={receiptId:randomUUID(),paymentId,status:'ISSUED',issuedAt:new Date().toISOString(),voidedAt:null,replacementReceiptId:null};const prior=all.find(x=>x.status==='VOIDED'&&!x.replacementReceiptId);if(prior)await this.guard.replaceReceipt(prior.receiptId,value);else await this.guard.issueReceipt(value);return this.from(value);}
  async findById(id:string){const v=await this.tx.run(({repositories})=>repositories.finance.findReceipt(id));if(!v)throw new NotFoundException(`Receipt not found: ${id}`);return this.from(v);}
  async findByPaymentId(id?:string){return(await this.tx.run(({repositories})=>repositories.finance.findReceiptsForPayment(id))).map(x=>this.from(x));}
  async void(id:string){const v=await this.tx.run(({repositories})=>repositories.finance.findReceipt(id));if(!v)throw new NotFoundException(`Receipt not found: ${id}`);if(v.status==='VOIDED')throw new BadRequestException('Receipt is already voided');v.status='VOIDED';v.voidedAt=new Date().toISOString();await this.tx.run(({repositories})=>repositories.finance.updateReceipt(v));return this.from(v);}
  private from(v:StoredReceipt):ReceiptRecord{return{id:v.receiptId,paymentId:v.paymentId,status:v.status as ReceiptRecord['status'],issuedAt:v.issuedAt,...(v.voidedAt?{voidedAt:v.voidedAt}:{}),...(v.replacementReceiptId?{replacementReceiptId:v.replacementReceiptId}:{})};}
}
