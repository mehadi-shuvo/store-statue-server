const SwaggerParser = require("@apidevtools/swagger-parser");
const { openApiDocument } = require("../dist/docs/openapi.js");

SwaggerParser.validate(openApiDocument)
  .then(() => {
    process.stdout.write("OpenAPI document is valid.\n");
  })
  .catch((error) => {
    process.stderr.write(`OpenAPI validation failed: ${error.message}\n`);
    process.exitCode = 1;
  });
