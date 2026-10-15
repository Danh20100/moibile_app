import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsInt,
  IsUUID,
  Max,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OpenConversationDto {
  @IsIn(['inquiry', 'tenancy']) contextType!: 'inquiry' | 'tenancy';
  @IsUUID() contextId!: string;
}
export class MessageImageDto {
  @IsIn(['image/jpeg']) contentType!: 'image/jpeg';
  @IsString() @MaxLength(2666668) base64!: string;
}
export class PostMessageDto {
  @IsOptional() @IsString() @MaxLength(4000) text?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => MessageImageDto)
  images?: MessageImageDto[];
}

export class ListMessagesQueryDto {
  @IsOptional() @IsString() @MaxLength(512) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
