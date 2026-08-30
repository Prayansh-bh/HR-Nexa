import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { IntegrationsModule } from '../../modules/integrations/integrations.module';

@Global()
@Module({
  imports: [IntegrationsModule],
  providers: [
    StorageService,
    LocalStorageProvider,
    S3StorageProvider,
  ],
  exports: [
    StorageService,
    LocalStorageProvider,
    S3StorageProvider,
  ],
})
export class StorageModule {}
