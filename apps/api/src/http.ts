import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { ZodError, z } from "zod";
export function fail(code: string, message: string, status = 409): never {
  throw new HttpException({ code, message }, status);
}
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  return schema.parse(input);
}
export function uuid(input: string) {
  return parse(z.uuid(), input);
}
@Catch()
export class ApiErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    if (error instanceof ZodError)
      return response.status(422).json({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        issues: error.issues,
      });
    if (error instanceof HttpException) {
      const body = error.getResponse();
      return response
        .status(error.getStatus())
        .json(
          typeof body === "string"
            ? { code: "REQUEST_ERROR", message: body }
            : body,
        );
    }
    const dbCode = (error as { driverError?: { code?: string } })?.driverError
      ?.code;
    if (
      dbCode &&
      ["23505", "23P01", "23503", "23514", "40P01"].includes(dbCode)
    )
      return response
        .status(409)
        .json({
          code: "DATA_CONFLICT",
          message:
            "Dữ liệu đang được sử dụng, trùng lịch hoặc có yêu cầu đồng thời. Vui lòng kiểm tra và thử lại.",
        });
    console.error(
      "Unhandled API error",
      error instanceof Error ? error.name : "unknown",
    );
    return response.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Không thể xử lý yêu cầu. Vui lòng thử lại.",
    });
  }
}
