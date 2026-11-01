import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  Injectable,
  Module,
  UseGuards,
  Get,
  SetMetadata,
  ExecutionContext,
  CanActivate,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Throttle } from "@nestjs/throttler";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule, PassportStrategy, AuthGuard } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { DataSource } from "typeorm";
import { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { credentialsSchema, Principal, Role } from "@starlight/contracts";
import { hash, hashPassword, verifyPassword } from "./security";
import { required, secret } from "./config";
import { fail, parse } from "./http";
export type AuthRequest = Request & { user: Principal };
export const Roles = (...roles: Role[]) => SetMetadata("roles", roles);
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(DataSource) private db: DataSource) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret("JWT_SECRET"),
    });
  }
  async validate(payload: { sub: string; sid: string }) {
    const [user] = await this.db.query(
      `SELECT u.id,u.role,s.id AS "sessionId" FROM users u JOIN refresh_sessions s ON s.user_id=u.id WHERE u.id=$1 AND s.id=$2 AND NOT s.revoked AND s.expires_at>clock_timestamp()`,
      [payload.sub, payload.sid],
    );
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
@Injectable()
export class JwtGuard extends AuthGuard("jwt") {}
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>("roles", [
      context.getHandler(),
      context.getClass(),
    ]);
    return (
      !roles ||
      roles.includes(context.switchToHttp().getRequest<AuthRequest>().user.role)
    );
  }
}
@Injectable()
export class AuthService {
  constructor(
    @Inject(DataSource) private db: DataSource,
    @Inject(JwtService) private jwt: JwtService,
  ) {}
  async login(email: string, password: string) {
    const [user] = await this.db.query("SELECT * FROM users WHERE email=$1", [
      email.toLowerCase(),
    ]);
    if (!user || !verifyPassword(password, user.password_hash))
      fail("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.", 401);
    const token = randomBytes(32).toString("base64url");
    const [session] = await this.db.query(
      `INSERT INTO refresh_sessions(user_id,token_hash,expires_at) VALUES($1,$2,clock_timestamp()+interval '7 days') RETURNING id`,
      [user.id, hash(token)],
    );
    return { ...this.access(user, session.id), refreshToken: token };
  }
  access(user: { id: string; email: string; role: Role }, sid: string) {
    return {
      accessToken: this.jwt.sign({ sub: user.id, sid }, { expiresIn: "15m" }),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
  async refresh(token: string) {
    return this.db.transaction(async (m) => {
      const [session] = await m.query(
        `SELECT * FROM refresh_sessions WHERE token_hash=$1 AND NOT revoked AND expires_at>clock_timestamp() FOR UPDATE`,
        [hash(token)],
      );
      if (!session) fail("SESSION_EXPIRED", "Phiên đăng nhập đã hết hạn.", 401);
      const [user] = await m.query("SELECT * FROM users WHERE id=$1", [
        session.user_id,
      ]);
      const next = randomBytes(32).toString("base64url");
      await m.query("UPDATE refresh_sessions SET token_hash=$1 WHERE id=$2", [
        hash(next),
        session.id,
      ]);
      return { ...this.access(user, session.id), refreshToken: next };
    });
  }
  async register(email: string, password: string) {
    const rows = await this.db.query(
      `INSERT INTO users(email,password_hash,role) VALUES($1,$2,'CUSTOMER') ON CONFLICT(email) DO NOTHING RETURNING id`,
      [email.toLowerCase(), hashPassword(password)],
    );
    if (!rows.length) fail("EMAIL_EXISTS", "Email đã được sử dụng.");
    return this.login(email, password);
  }
  async logout(token: string) {
    await this.db.query(
      "UPDATE refresh_sessions SET revoked=true WHERE token_hash=$1",
      [hash(token)],
    );
    return { ok: true };
  }
}
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private auth: AuthService) {}
  private origin(req: Request) {
    if (req.headers.origin !== required("WEB_ORIGIN"))
      fail("INVALID_ORIGIN", "Nguồn yêu cầu không hợp lệ.", 403);
  }
  private cookie(res: Response, value: string) {
    res.cookie("starlight_refresh", value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: 7 * 86400000,
    });
  }
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login")
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.origin(req);
    const value = parse(credentialsSchema, body);
    const { refreshToken, ...result } = await this.auth.login(
      value.email,
      value.password,
    );
    this.cookie(res, refreshToken);
    return result;
  }
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("register")
  async register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.origin(req);
    const value = parse(credentialsSchema, body);
    const { refreshToken, ...result } = await this.auth.register(
      value.email,
      value.password,
    );
    this.cookie(res, refreshToken);
    return result;
  }
  @Post("refresh") async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.origin(req);
    const { refreshToken, ...result } = await this.auth.refresh(
      req.cookies?.starlight_refresh || "",
    );
    this.cookie(res, refreshToken);
    return result;
  }
  @Post("logout") async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.origin(req);
    const result = await this.auth.logout(req.cookies?.starlight_refresh || "");
    res.clearCookie("starlight_refresh", { path: "/api/v1/auth" });
    return result;
  }
  @Get("me") @UseGuards(JwtGuard) me(@Req() req: AuthRequest) {
    return req.user;
  }
}
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({ secret: secret("JWT_SECRET") }),
    }),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, JwtGuard, RoleGuard, AuthService],
  exports: [JwtGuard, RoleGuard, AuthService],
})
export class AuthModule {}
