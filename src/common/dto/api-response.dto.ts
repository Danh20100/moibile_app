import { ApiProperty } from '@nestjs/swagger';

export class BaseResponseDto<T> {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty()
  data!: T;

  @ApiProperty({ example: '2026-09-25T00:00:00.000Z' })
  timestamp!: string;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: '2026-09-25T00:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/rooms' })
  path!: string;

  @ApiProperty({ example: 'Bad Request' })
  message!: string;

  @ApiProperty({ required: false, nullable: true })
  errors?: unknown;
}
