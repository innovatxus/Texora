import { clientEnvSchema, parseEnv, serverEnvSchema } from "./schema";

const validClient = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-texora.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-texora",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-texora.appspot.com",
  NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app-id",
};

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64");

describe("clientEnvSchema", () => {
  it("applies emulator defaults", () => {
    const env = parseEnv(clientEnvSchema, validClient, "client");
    expect(env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS).toBe(false);
    expect(env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST).toBe("127.0.0.1");
  });

  it("parses boolean strings", () => {
    const env = parseEnv(
      clientEnvSchema,
      { ...validClient, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true" },
      "client",
    );
    expect(env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS).toBe(true);
  });

  it("reports every invalid variable in one error", () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        { ...validClient, NEXT_PUBLIC_SITE_URL: "nope", NEXT_PUBLIC_FIREBASE_APP_ID: "" },
        "client",
      ),
    ).toThrowError(/NEXT_PUBLIC_SITE_URL[\s\S]*NEXT_PUBLIC_FIREBASE_APP_ID/);
  });
});

describe("serverEnvSchema", () => {
  it("requires emulator hosts when emulators are enabled", () => {
    expect(() =>
      parseEnv(
        serverEnvSchema,
        {
          FIREBASE_PROJECT_ID: "demo-texora",
          FIREBASE_STORAGE_BUCKET: "demo-texora.appspot.com",
          USE_FIREBASE_EMULATORS: "true",
        },
        "server",
      ),
    ).toThrowError(/FIRESTORE_EMULATOR_HOST[\s\S]*FIREBASE_AUTH_EMULATOR_HOST/);
  });

  it("requires a service account in production without emulators", () => {
    expect(() =>
      parseEnv(
        serverEnvSchema,
        {
          FIREBASE_PROJECT_ID: "texora",
          FIREBASE_STORAGE_BUCKET: "texora.appspot.com",
          NODE_ENV: "production",
        },
        "server",
      ),
    ).toThrowError(/FIREBASE_SERVICE_ACCOUNT/);
  });

  it("decodes a base64 service account", () => {
    const env = parseEnv(
      serverEnvSchema,
      {
        FIREBASE_PROJECT_ID: "texora",
        FIREBASE_STORAGE_BUCKET: "texora.appspot.com",
        NODE_ENV: "production",
        FIREBASE_SERVICE_ACCOUNT: encode({
          project_id: "texora",
          client_email: "svc@texora.iam.gserviceaccount.com",
          private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
        }),
      },
      "server",
    );
    expect(env.FIREBASE_SERVICE_ACCOUNT?.client_email).toBe("svc@texora.iam.gserviceaccount.com");
  });

  it("rejects a malformed service account", () => {
    expect(() =>
      parseEnv(
        serverEnvSchema,
        {
          FIREBASE_PROJECT_ID: "texora",
          FIREBASE_STORAGE_BUCKET: "texora.appspot.com",
          FIREBASE_SERVICE_ACCOUNT: "not-base64-json",
        },
        "server",
      ),
    ).toThrowError(/base64-encoded service-account JSON/);
  });
});
