import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { DatabaseKeepAliveService } from '../common/database/database-keep-alive.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PrismaService, DatabaseKeepAliveService],
  exports: [PrismaService, DatabaseKeepAliveService],
})
export class PrismaModule {}
