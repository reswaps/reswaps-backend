import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@reswaps/prisma";
@Injectable()
export class PrismaService extends PrismaClient {}
