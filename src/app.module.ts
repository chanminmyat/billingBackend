import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BillingModule } from './billing/billing.module';
import { CollectorsModule } from './collectors/collectors.module';
import { CustomersModule } from './customers/customers.module';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { PlansModule } from './plans/plans.module';
import { SubscriptionNetworksModule } from './subscription-networks/subscription-networks.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';
import { TechnicianApiModule } from './technician-api/technician-api.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const sslEnabled =
          config.get<string>('DB_SSL', 'false').toLowerCase() === 'true';
        const forceSslForUrl = Boolean(databaseUrl);
        const isProduction = config.get<string>('NODE_ENV') === 'production';
        const syncFromEnv = config.get<string>('DB_SYNCHRONIZE');
        const shouldSync =
          syncFromEnv !== undefined
            ? syncFromEnv.toLowerCase() === 'true'
            : !isProduction;

        return {
          type: 'postgres',
          url: databaseUrl ?? undefined,
          host: databaseUrl ? undefined : config.get<string>('DB_HOST', 'localhost'),
          port: databaseUrl
            ? undefined
            : parseInt(config.get<string>('DB_PORT', '5432'), 10),
          username: databaseUrl
            ? undefined
            : config.get<string>('DB_USERNAME', 'postgres'),
          password: databaseUrl
            ? undefined
            : config.get<string>('DB_PASSWORD', 'postgres'),
          database: databaseUrl
            ? undefined
            : config.get<string>('DB_NAME', 'billing'),
          autoLoadEntities: true,
          schema: 'public',
          synchronize: shouldSync,
          ssl: sslEnabled || forceSslForUrl
            ? {
                rejectUnauthorized: false,
              }
            : undefined,
        };
      },
    }),
    UsersModule,
    CollectorsModule,
    CustomersModule,
    PasswordResetModule,
    PlansModule,
    SubscriptionsModule,
    SubscriptionNetworksModule,
    BillingModule,
    AuthModule,
    TechnicianApiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
