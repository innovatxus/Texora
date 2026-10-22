import { clientEnvSchema, parseEnv, serverEnvSchema } from "./schema";

const validClient = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-texora.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-texora",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-texora.appspot.com",
  ORDER_TOKEN_SECRET: "x".repeat(32),
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
          ORDER_TOKEN_SECRET: "x".repeat(32),
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
          ORDER_TOKEN_SECRET: "x".repeat(32),
          RESEND_API_KEY: "re_test",
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
        ORDER_TOKEN_SECRET: "x".repeat(32),
        RESEND_API_KEY: "re_test",
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

  it("requires Resend in production unless it's a STAGING test deployment", () => {
    const production = {
      FIREBASE_PROJECT_ID: "texora",
      FIREBASE_STORAGE_BUCKET: "texora.appspot.com",
      ORDER_TOKEN_SECRET: "x".repeat(32),
      NODE_ENV: "production",
      FIREBASE_SERVICE_ACCOUNT: encode({
        project_id: "texora",
        client_email: "svc@texora.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
      }),
    };
    expect(() => parseEnv(serverEnvSchema, production, "server")).toThrowError(/RESEND_API_KEY/);
    expect(parseEnv(serverEnvSchema, { ...production, STAGING: "true" }, "server").STAGING).toBe(
      true,
    );
  });

  it("treats a blank service account as unset", () => {
    const env = parseEnv(
      serverEnvSchema,
      {
        FIREBASE_PROJECT_ID: "demo-texora",
        FIREBASE_STORAGE_BUCKET: "demo-texora.appspot.com",
        ORDER_TOKEN_SECRET: "x".repeat(32),
        FIREBASE_SERVICE_ACCOUNT: "",
      },
      "server",
    );
    expect(env.FIREBASE_SERVICE_ACCOUNT).toBeUndefined();
  });

  it("refuses emulator mode for a real project", () => {
    expect(() =>
      parseEnv(
        serverEnvSchema,
        {
          FIREBASE_PROJECT_ID: "texora-fashion",
          FIREBASE_STORAGE_BUCKET: "texora-fashion.firebasestorage.app",
          ORDER_TOKEN_SECRET: "x".repeat(32),
          USE_FIREBASE_EMULATORS: "true",
          FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
          FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
        },
        "server",
      ),
    ).toThrowError(/Emulators are for automated tests/);
  });

  it("treats any blank value as unset", () => {
    const env = parseEnv(
      serverEnvSchema,
      {
        FIREBASE_PROJECT_ID: "demo-texora",
        FIREBASE_STORAGE_BUCKET: "demo-texora.appspot.com",
        ORDER_TOKEN_SECRET: "x".repeat(32),
        RESEND_API_KEY: "",
        CRON_SECRET: "",
      },
      "server",
    );
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.CRON_SECRET).toBeUndefined();
  });

  it("rejects a malformed service account", () => {
    expect(() =>
      parseEnv(
        serverEnvSchema,
        {
          FIREBASE_PROJECT_ID: "texora",
          FIREBASE_STORAGE_BUCKET: "texora.appspot.com",
          ORDER_TOKEN_SECRET: "x".repeat(32),
          RESEND_API_KEY: "re_test",
          FIREBASE_SERVICE_ACCOUNT: "not-base64-json",
        },
        "server",
      ),
    ).toThrowError(/base64-encoded service-account JSON/);
  });
});
