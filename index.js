const { createServer } = require('./src/server');

(async function main() {
  try {
    const server = await createServer({
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : 1234,
    });

    process.on('SIGINT', () => {
      console.log(`Shutting down...`);
      server.close(() => console.log('Bye!'));
    });
  } catch(ex) {
    console.error(`Failed to start: ${ex}`);
  }
})();