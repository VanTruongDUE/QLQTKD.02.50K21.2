import "reflect-metadata";
import { DataSource } from "typeorm";
import { required } from "../config";
import { Initial1793494800000 } from "./migrations/Initial";
import { CheckInLocks1793581200000 } from "./migrations/CheckInLocks";
export const databaseOptions = {
  type: "postgres" as const,
  url: required("DATABASE_URL"),
  migrations: [Initial1793494800000, CheckInLocks1793581200000],
  synchronize: false,
};
export const source = new DataSource(databaseOptions);
