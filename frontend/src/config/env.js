import { warn } from "../utils/log";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  warn("VITE_API_BASE_URL is not set, API calls will fail.");
}

export const ENV = {
  API_BASE_URL: apiBaseUrl,
};
