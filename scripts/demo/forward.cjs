// Local development transport only: use the configured container without extracting its environment.
const net = require('node:net');
const { spawn } = require('node:child_process');
// ponytail: one docker exec per connection; publish a dedicated loopback demo port if throughput matters.
const bridge = 'const s=require("node:net").connect(3001,"127.0.0.1");process.stdin.pipe(s);s.pipe(process.stdout);s.on("error",()=>process.exit(1));s.on("close",()=>process.exit(0));';
const server = net.createServer((socket) => {
  const child = spawn('docker', ['exec', '-i', 'trooi-project-backend-1', 'node', '-e', bridge], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  socket.pipe(child.stdin);
  child.stdout.pipe(socket);
  socket.on('error', () => child.kill());
  socket.on('close', () => child.kill());
  child.stdin.on('error', () => socket.destroy());
  child.on('error', () => socket.destroy());
  child.on('exit', () => socket.destroy());
});
server.on('error', (error) => { console.error('Demo forwarding failed:', error.code); process.exit(1); });
server.listen(3001, '127.0.0.1', () => console.log('Local demo forwarding ready on 127.0.0.1:3001'));
