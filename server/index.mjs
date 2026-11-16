import { fileURLToPath } from "node:url";
import { createApp } from "./app.mjs";

const port=Number(process.env.PORT??8080);
const server=createApp({
  assets:fileURLToPath(new URL("../dist",import.meta.url)),
  database:process.env.DATABASE_PATH??"./data/tracker.sqlite",
  origin:process.env.APP_ORIGIN??`http://localhost:${port}`,
  inviteCode:process.env.REGISTRATION_CODE,
});
server.listen(port,process.env.BIND_HOST??"127.0.0.1",()=>console.log(`Flight Deck listening on port ${port}`));
for(const signal of ["SIGTERM","SIGINT"]) process.once(signal,()=>server.close());
