import "reflect-metadata";
import { DataSource } from "typeorm";
import { required } from "../config";
import { Initial1793494800000 } from "./migrations/Initial";
import { CheckInLocks1793581200000 } from "./migrations/CheckInLocks";
import { Operations1793667600000 } from "./migrations/Operations";
import { ProviderEvents1793667600001 } from "./migrations/ProviderEvents";
import { CatalogProvenance1793667600002 } from "./migrations/CatalogProvenance";
import { NotificationOutbox1793754000000 } from "./migrations/NotificationOutbox";
import { PaymentProviderReference1793754000001 } from "./migrations/PaymentProviderReference";
import { ProductCatalogDetails1793754000002 } from "./migrations/ProductCatalogDetails";
import { ProductPresentation1793840400000 } from "./migrations/ProductPresentation";
export const databaseOptions = {
  type: "postgres" as const,
  url: required("DATABASE_URL"),
  migrations: [
    Initial1793494800000,
    CheckInLocks1793581200000,
    Operations1793667600000,
    ProviderEvents1793667600001,
    CatalogProvenance1793667600002,
    NotificationOutbox1793754000000,
    PaymentProviderReference1793754000001,
    ProductCatalogDetails1793754000002,
    ProductPresentation1793840400000,
  ],
  synchronize: false,
};
export const source = new DataSource(databaseOptions);
