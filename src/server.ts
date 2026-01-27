import app from "./app";
import { ENV } from "./utils/env-config";

const port = ENV.PORT || 5000;
async function main() {
  try {
    app.listen(port, () => {
      console.log(
        `[server 🔥⚡]: Server is running at http://localhost:${port}`
      );
    });
  } catch (err) {
    throw new Error("server is down!");
  }
}

main();
