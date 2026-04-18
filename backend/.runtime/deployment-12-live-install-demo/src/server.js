const express = require("express");

const app = express();
const port = Number(process.env.PORT || 3000);

app.get("/", (_req, res) => {
  res.send(`<!doctype html><html><body><h1>Live Install Deploy Works</h1><p>PORT=${port}</p></body></html>`);
});

app.listen(port, "127.0.0.1", () => {
  console.log(`runtime up on ${port}`);
});
