import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { AutoCacheInterceptor } from './auto-cache.interceptor';

@Global()
@Module({
  providers: [CacheService, AutoCacheInterceptor],
  exports: [CacheService, AutoCacheInterceptor],
})
export class CacheModule {}
