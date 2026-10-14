import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, IsUUID, MaxLength } from 'class-validator';

export class UploadListingAssetMediaDto {
  @IsUUID() mediaId!: string;
  @IsIn(['image/jpeg', 'image/png']) contentType!: 'image/jpeg' | 'image/png';
  @IsString() @MaxLength(6990508) base64!: string;
}

export class ReorderListingAssetMediaDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsUUID('all', { each: true }) mediaIds!: string[];
}
