const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  // eslint-disable-next-line no-console
  console.warn("VITE_API_BASE_URL is not set – API calls will fail.");
}

export const ENV = {
  API_BASE_URL: apiBaseUrl,
};
