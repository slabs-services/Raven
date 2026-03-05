import Fastify from 'fastify';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { CreateOutbox } from './routes/Outbox.js';
import { authMiddlewareUser } from './Middlewares/Auth.js';
dotenv.config();

const fastify = Fastify();

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD
});

fastify.decorate("db", connection);

fastify.post('/createOutbox', { preHandler: authMiddlewareUser }, CreateOutbox);
fastify.post('/swapRavenService', { preHandler: authMiddlewareUser }, SwapRavenService);

await fastify.listen({ host: '127.0.0.1', port: 8080 });