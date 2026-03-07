import Fastify from 'fastify';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { CreateOutbox } from './routes/Outbox.js';
import { authMiddlewareUser } from './Middlewares/Auth.js';
import { CheckOwner } from './routes/Security.js';
import { SendEmail } from './routes/Mail.js';
import nodemailer from "nodemailer";

dotenv.config();

const fastify = Fastify();

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD
});

const transporter = nodemailer.createTransport({
    host: "raven.spacelabs.pt",
    port: 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
});

fastify.decorate("db", connection);
fastify.decorate("mail", transporter);

fastify.post('/createOutbox', { preHandler: authMiddlewareUser }, CreateOutbox);
fastify.post('/sendMail', { preHandler: authMiddlewareUser }, SendEmail);
fastify.get('/checkOwner', CheckOwner);

await fastify.listen({ host: '127.0.0.1', port: 8080 });