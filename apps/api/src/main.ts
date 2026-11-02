import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app";
import { ApiErrors } from "./http";
import { required, secret } from "./config";
export async function bootstrap(port = Number(process.env.PORT || 4000)) {
  secret("JWT_SECRET");
  secret("QR_SECRET");
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: required("WEB_ORIGIN"), credentials: true });
  app.useGlobalFilters(new ApiErrors());
  app.enableShutdownHooks();
  await app.listen(port, "0.0.0.0");
  return app;
}
if (require.main === module)
  bootstrap().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
