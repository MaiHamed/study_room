const { port } = require("./config/env");
const app = require("./app");

const server = app.listen(port(), () => {
  process.stdout.write(`Studyroom API listening on http://localhost:${port()}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
