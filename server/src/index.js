import { createServer } from 'node:http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { handleMessage } from './handleMessage.js';
import { loadGame } from './loadGame.js';
import { createStore } from './sessions.js';

const app = express();
const server = createServer(app);
const sockets = new WebSocketServer({ server, path: '/ws' });
const store = createStore();
const log = (...parts) => console.log(...parts);

sockets.on('connection', (socket) => {
  let busy = false;

  socket.on('message', (data) => {
    if (busy) return;
    busy = true;
    Promise.resolve(handleMessage(store, loadGame, log, socket, data.toString()))
      .catch((error) => {
        console.error(error);
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ type: 'error', message: 'Something went wrong.' }));
        }
      })
      .finally(() => {
        busy = false;
      });
  });

  socket.on('close', () => store.detachSocket(socket));
});

const port = Number(process.env.PORT) || 3001;
server.listen(port, () => {
  console.log(`Game server listening on ${port}`);
});
