import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  CLIENT_EVENTS,
  SOCKET_NAMESPACE,
  jobRoom,
  submissionRoom,
} from '@vedaai/shared';

@WebSocketGateway({
  namespace: SOCKET_NAMESPACE,
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(CLIENT_EVENTS.SUBSCRIBE_JOB)
  subscribeJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { jobId: string },
  ) {
    if (!body?.jobId) return { ok: false };
    void client.join(jobRoom(body.jobId));
    this.logger.debug(`${client.id} → ${jobRoom(body.jobId)}`);
    return { ok: true, room: jobRoom(body.jobId) };
  }

  @SubscribeMessage(CLIENT_EVENTS.SUBSCRIBE_SUBMISSION)
  subscribeSubmission(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { submissionId: string },
  ) {
    if (!body?.submissionId) return { ok: false };
    void client.join(submissionRoom(body.submissionId));
    return { ok: true, room: submissionRoom(body.submissionId) };
  }

  @SubscribeMessage(CLIENT_EVENTS.UNSUBSCRIBE)
  unsubscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { room: string }) {
    if (body?.room) void client.leave(body.room);
    return { ok: true };
  }
}
