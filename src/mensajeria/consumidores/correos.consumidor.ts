import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConsumeMessage } from 'amqplib';
import { Repository } from 'typeorm';
import { MensajeriaService } from '../mensajeria.service.js';
import { COLAS } from '../topologia.js';
import { Notificacion } from '../../persistencia/notificacion.entity.js';
import { conReintentos, detalle, esDelMensaje, MensajeInvalido, REINTENTOS } from '../reintentos.js';

@Injectable()
export class CorreosConsumidor implements OnModuleInit {
  private readonly log = new Logger(CorreosConsumidor.name);

  constructor(
    private readonly mensajeria: MensajeriaService,
    @InjectRepository(Notificacion)
    private readonly notificaciones: Repository<Notificacion>,
  ) {}

  async onModuleInit(): Promise<void> {
    const canal = this.mensajeria.canal;

    await canal.consume(
      COLAS.correos,
      (mensaje: ConsumeMessage | null) => {
        if (!mensaje) return;

        void this.procesar(mensaje);
      },
      { noAck: false },
    );

    this.log.log(`escuchando la cola ${COLAS.correos}`);
  }

  private async procesar(mensaje: ConsumeMessage): Promise<void> {
    const canal = this.mensajeria.canal;

    try {
      const comando = JSON.parse(mensaje.content.toString()) as Record<string, unknown>;
      const { para, asunto, origen, eventoId } = comando;

      // Validación de negocio: para y asunto son requeridos como string
      if (typeof para !== 'string' || para === '') {
        throw new MensajeInvalido('el comando no trae para valido');
      }
      if (typeof asunto !== 'string' || asunto === '') {
        throw new MensajeInvalido('el comando no trae asunto valido');
      }

      // "Envío" simulado del correo
      this.log.log(`para: ${para} | asunto: ${asunto} | origen: ${String(origen)}`);

      // Inserción en BD protegida con reintentos
      await conReintentos(
        () =>
          this.notificaciones.insert({
            para,
            asunto,
            estado: 'enviada',
            eventoId: typeof eventoId === 'string' ? eventoId : undefined,
          }),
        (intento, error) =>
          this.log.warn(`intento ${intento} de ${REINTENTOS.maximo} fallido para notificacion: ${detalle(error)}`),
      );

      canal.ack(mensaje);
    } catch (error) {
      canal.nack(mensaje, false, false);
      const ruta = esDelMensaje(error) ? 'mensaje invalido' : `la base no respondio en ${REINTENTOS.maximo} intentos`;
      this.log.error(`${ruta}, hacia la DLQ: ${detalle(error)}`);
    }
  }
}