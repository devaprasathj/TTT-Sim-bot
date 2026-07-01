const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const preferredPort = Number(process.env.PORT || 5502);
const maxPortAttempts = 10;

const mimeTypes = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
	try {
		const { pathname } = new URL(req.url, 'http://localhost');
		const requestPath = pathname === '/' ? '/index.html' : pathname;
		const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^([.]{2}[\/\\])+/, '').replace(/^\/+/, '');
		const filePath = path.join(__dirname, safePath);
		const ext = path.extname(filePath).toLowerCase();
		const contentType = mimeTypes[ext] || 'application/octet-stream';

		const fileBuffer = await readFile(filePath);
		res.writeHead(200, { 'Content-Type': contentType });
		res.end(fileBuffer);
	} catch (error) {
		res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
		res.end('Not found');
	}
});

server.once('listening', () => {
	const address = server.address();
	const activePort = typeof address === 'object' && address ? address.port : preferredPort;
	console.log(`Static frontend server running on http://localhost:${activePort}`);
	console.log('Serving frontend/index.html, frontend/style.css, and frontend/script.js.');
});

const startServer = (port, attemptsLeft) => {
	server.once('error', (error) => {
		if (error.code === 'EADDRINUSE' && attemptsLeft > 0) {
			startServer(port + 1, attemptsLeft - 1);
			return;
		}

		throw error;
	});

	server.listen(port);
};

startServer(preferredPort, maxPortAttempts);
