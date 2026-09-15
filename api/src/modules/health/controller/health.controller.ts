import { checkDatabaseConnection } from "../service/health.service.js";

export async function getHealth() {
  return checkDatabaseConnection();
}
