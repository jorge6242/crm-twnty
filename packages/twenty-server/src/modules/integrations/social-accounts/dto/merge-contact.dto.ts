import { IsOptional, IsString, IsUrl } from 'class-validator';

export class MergeContactDto {
  @IsString()
  id: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsUrl()
  publicProfileUrl?: string;

  @IsOptional()
  @IsString()
  profilePictureUrl?: string;
}
