function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  domain: required("DOMAIN"),
  apiKey: required("API_KEY"),
};
