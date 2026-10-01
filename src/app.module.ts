import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditoriaModule } from './mensajeria/consumidores/auditoria.module.js';
import { MensajeriaModule } from './mensajeria/mensajeria.module.js';
import { SaludController } from './salud.controller.js';
import { NotificacionesModule } from './mensajeria/consumidores/notificaciones.module.js';


@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MensajeriaModule, AuditoriaModule, NotificacionesModule],
  controllers: [SaludController],
})
export class AppModule {}