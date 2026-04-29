import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8080);
const INGEST_KEY = process.env.INGEST_KEY || 'dev-key';

const app = express();
const server = http.createServer(app);

app.use('/overlay', express.static(path.join(__dirname, 'public/overlay')));

app.get('/', (_req, res) => {
  res.type('text/plain').send('CHZZK Chat Overlay Server OK');
});

app.get('/api/style/:clientId', (req, res) => {
  const clientId = safeName(req.params.clientId || 'demo');
  const clientFile = path.join(__dirname, 'config', `${clientId}.json`);
  const defaultFile = path.join(__dirname, 'config', 'default-style.json');
  const file = fs.existsSync(clientFile) ? clientFile : defaultFile;
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

app.get('/chat/:clientId', (req, res) => {
  const clientId = safeName(req.params.clientId || 'demo');
  res.redirect(`/overlay/index.html?client=${encodeURIComponent(clientId)}`);
});

const overlayClients = new Map(); // clientId -> Set(ws)

const overlayWss = new WebSocketServer({ noServer: true });
const receiverWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/overlay-ws') {
    overlayWss.handleUpgrade(req, socket, head, (ws) => overlayWss.emit('connection', ws, req));
    return;
  }
  if (url.pathname === '/receiver') {
    receiverWss.handleUpgrade(req, socket, head, (ws) => receiverWss.emit('connection', ws, req));
    return;
  }
  socket.destroy();
});

overlayWss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientId = safeName(url.searchParams.get('client') || 'demo');
  if (!overlayClients.has(clientId)) overlayClients.set(clientId, new Set());
  overlayClients.get(clientId).add(ws);
  ws.send(JSON.stringify({ type: 'system', status: 'connected', clientId }));
  ws.on('close', () => overlayClients.get(clientId)?.delete(ws));
});

receiverWss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const key = url.searchParams.get('key');
  const clientId = safeName(url.searchParams.get('client') || 'demo');
  if (key !== INGEST_KEY) {
    ws.close(1008, 'Invalid ingest key');
    return;
  }
  ws.on('message', (buf) => {
    try {
      const data = JSON.parse(buf.toString());
      if (data.type === 'chat') broadcast(clientId, data);
      if (data.type === 'deleteMessage' || data.type === 'deleteUser') broadcast(clientId, data);
    } catch (e) {
      console.error('Receiver message parse error:', e);
    }
  });
});

function broadcast(clientId, payload) {
  const targets = overlayClients.get(clientId);
  if (!targets) return;
  const msg = JSON.stringify(payload);
  for (const ws of targets) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'demo';
}

server.listen(PORT, () => {
  console.log(`Overlay server: http://localhost:${PORT}/chat/${process.env.CLIENT_ID || 'demo'}`);
});
