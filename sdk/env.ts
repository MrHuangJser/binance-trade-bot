import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../.env") });

export const API_URL = process.env.API_URL as string;
export const API_KEY = process.env.API_KEY as string;
export const API_SECRET = process.env.API_SECRET as string;
