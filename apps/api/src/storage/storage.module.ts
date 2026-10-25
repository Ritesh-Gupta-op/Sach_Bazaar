import { Global, Module } from '@nestjs/common';
import { IndexerService } from './indexer.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [StorageService, IndexerService],
  exports: [StorageService],
})
export class StorageModule {}
