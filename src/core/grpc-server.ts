import * as grpc from 'grpc';
import { CogServiceService as CogService } from '../proto/cog_grpc_pb';
import { Cog } from './cog';
import { ClientWrapper } from '../client/client-wrapper';
import * as redis from 'redis';

const server = new grpc.Server();
const port = process.env.PORT || 28866;
const host = process.env.HOST || '0.0.0.0';
let credentials: grpc.ServerCredentials;
let redisClient: {};

if (process.env.USE_SSL) {
  credentials = grpc.ServerCredentials.createSsl(
    Buffer.from(process.env.SSL_ROOT_CRT, 'base64'), [{
      cert_chain: Buffer.from(process.env.SSL_CRT, 'base64'),
      private_key: Buffer.from(process.env.SSL_KEY, 'base64'),
    }],
    true,
  );
} else {
  credentials = grpc.ServerCredentials.createInsecure();
}

if (process.env.REDIS_URL) {
  // Hosted environment redis connection.
  redisClient = redis.createClient(process.env.REDIS_URL);
} else {
  // Local client (requires no auth details).
  // redisClient = redis.createClient();
}
server.addService(CogService, new Cog(ClientWrapper));
server.bind(`${host}:${port}`, credentials);
server.start();
console.log(`Server started, listening: ${host}:${port}`);

// Export server for testing.
export default server;
