import "reflect-metadata";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { databaseOptions } from "./database/source";
import { AuthModule } from "./auth";
import { CinemaModule } from "./cinema";
@Module({
  imports: [
    TypeOrmModule.forRoot(databaseOptions),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    AuthModule,
    CinemaModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
