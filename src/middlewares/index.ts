import { Request, Response, NextFunction } from "express";
import { Injectable, NestMiddleware, Logger } from "@nestjs/common";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger("HTTP");

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl, body } = request;
    const userAgent = request.get("user-agent") || "";

    response.on("finish", () => {
      const { statusCode } = response;
      const contentLength = response.get("content-length");

      const logString = `${statusCode} ${method} ${originalUrl} ${contentLength} - ${userAgent} ${ip}. Body: ${JSON.stringify(body)}`;

      if (statusCode < 400) {
        this.logger.log(logString);
      } else {
        this.logger.error(logString);
      }
    });

    next();
  }
}
